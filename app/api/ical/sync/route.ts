import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// Minimal iCal parser — handles VCALENDAR/VEVENT blocks
function parseICal(text: string): ICalEvent[] {
  const events: ICalEvent[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    // Unfold lines (RFC 5545 line folding)
    .replace(/\n[ \t]/g, '')
    .split('\n')

  let current: Partial<ICalEvent> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT' && current) {
      if (current.uid && current.dtstart) events.push(current as ICalEvent)
      current = null
      continue
    }
    if (!current) continue

    // Parse property:value (handle parameters like DTSTART;TZID=...)
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const propFull = line.slice(0, colonIdx).toUpperCase()
    const value = line.slice(colonIdx + 1).trim()
    const prop = propFull.split(';')[0]

    switch (prop) {
      case 'UID':       current.uid = value; break
      case 'SUMMARY':   current.summary = decodeICal(value); break
      case 'DESCRIPTION': current.description = decodeICal(value); break
      case 'DTSTART':   current.dtstart = parseICalDate(value); break
      case 'DTEND':     current.dtend = parseICalDate(value); break
      case 'LOCATION':  current.location = decodeICal(value); break
      case 'STATUS':    current.status = value; break
      case 'ORGANIZER': current.organizer = value.replace(/^.*?:/,''); break
    }
  }
  return events
}

interface ICalEvent {
  uid: string
  summary: string
  description?: string
  dtstart: Date
  dtend?: Date
  location?: string
  status?: string
  organizer?: string
}

function decodeICal(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseICalDate(s: string): Date {
  // Handle YYYYMMDDTHHMMSSZ or YYYYMMDD
  const clean = s.replace(/[TZ]/g, '')
  if (clean.length === 8) {
    return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`)
  }
  return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(8,10)}:${clean.slice(10,12)}:${clean.slice(12,14)}Z`)
}

// Extract patient name from Doctolib SUMMARY format: "Dr Name - Patient Name" or "Patient Name - Dr Name"
function extractPatientFromSummary(summary: string): { first_name: string; last_name: string } | null {
  // Doctolib format: "NomPrénom Doctolib" or "Prénom NOM" in various patterns
  const parts = summary.split(/\s*[-–]\s*/)
  const candidate = parts.find(p => !p.toLowerCase().includes('dr') && !p.toLowerCase().includes('docteur')) ?? parts[0]
  const nameParts = candidate.trim().split(/\s+/)
  if (nameParts.length < 2) return null
  return {
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(' '),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { source_id, clinic_id } = await request.json()
    const supabase = getSupabase()

    // Get iCal source
    const { data: source } = await supabase
      .from('ical_sources')
      .select('*')
      .eq('id', source_id)
      .eq('clinic_id', clinic_id)
      .single()

    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    // Fetch the iCal feed
    let icalText: string
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'ClinicFlow-AI/1.0' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      icalText = await res.text()
    } catch (err: any) {
      return NextResponse.json({ error: `Failed to fetch iCal: ${err.message}` }, { status: 400 })
    }

    const events = parseICal(icalText)
    let created = 0, skipped = 0, patientCreated = 0

    // Get existing appointment UIDs to avoid duplicates
    // We store the iCal UID in the notes field with a prefix
    const { data: existingAppts } = await supabase
      .from('appointments')
      .select('notes')
      .eq('clinic_id', clinic_id)
      .like('notes', 'ical:%')

    const existingUids = new Set((existingAppts ?? []).map(a => a.notes?.replace('ical:', '')))

    for (const event of events) {
      if (existingUids.has(event.uid)) { skipped++; continue }
      if (event.status === 'CANCELLED') { skipped++; continue }
      if (event.dtstart < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) { skipped++; continue } // Skip > 30 days old

      // Try to find or create patient from event summary
      let patientId: string | null = null
      const extracted = extractPatientFromSummary(event.summary)

      if (extracted) {
        // Check if patient exists by name
        const { data: existing } = await supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', clinic_id)
          .ilike('last_name', extracted.last_name)
          .ilike('first_name', extracted.first_name)
          .maybeSingle()

        if (existing) {
          patientId = existing.id
        } else {
          // Create new patient from Doctolib event
          const { data: newPatient } = await supabase
            .from('patients')
            .insert({
              clinic_id,
              first_name: extracted.first_name,
              last_name: extracted.last_name,
              source: 'doctolib',
              notes: `Importé via sync iCal Doctolib le ${new Date().toLocaleDateString('fr-FR')}`,
            })
            .select('id')
            .single()

          if (newPatient) {
            patientId = newPatient.id
            patientCreated++

            // Create intake form link for this patient
            await supabase.from('patient_intake_forms').insert({
              clinic_id,
              patient_id: patientId,
              first_name: extracted.first_name,
              last_name: extracted.last_name,
              status: 'pending',
            })
          }
        }
      }

      // Create appointment
      const { error: apptError } = await supabase.from('appointments').insert({
        clinic_id,
        patient_id: patientId,
        appointment_date: event.dtstart.toISOString(),
        type: 'consultation',
        status: 'scheduled',
        source: 'doctolib',
        notes: `ical:${event.uid}`,
      })

      if (!apptError) created++
      else skipped++
    }

    // Update sync stats
    await supabase.from('ical_sources').update({
      last_synced_at: new Date().toISOString(),
      sync_count: (source.sync_count ?? 0) + created,
    }).eq('id', source_id)

    return NextResponse.json({
      success: true,
      total: events.length,
      created,
      skipped,
      patient_created: patientCreated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — test if an iCal URL is valid
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClinicFlow-AI/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ valid: false, error: `HTTP ${res.status}` })
    const text = await res.text()
    const isICal = text.includes('BEGIN:VCALENDAR')
    const eventCount = (text.match(/BEGIN:VEVENT/g) ?? []).length
    return NextResponse.json({ valid: isICal, event_count: eventCount })
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message })
  }
}
