import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(request: NextRequest) {
  const patient_id = request.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  const supabase = getSupabase()

  const [
    { data: patient },
    { data: consultations },
    { data: documents },
    { data: journey },
    { data: appointments },
  ] = await Promise.all([
    supabase.from('patients').select('*, clinic:clinics(name)').eq('id', patient_id).single(),
    supabase.from('consultations').select('*, treatment:treatments(name)').eq('patient_id', patient_id).order('consultation_date', { ascending: false }),
    supabase.from('generated_documents').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }),
    supabase.from('patient_journeys').select('*, treatment:treatments(name)').eq('patient_id', patient_id).maybeSingle(),
    supabase.from('appointments').select('*, treatment:treatments(name)').eq('patient_id', patient_id).order('appointment_date', { ascending: false }).limit(10),
  ])

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const clinicName = (patient as any).clinic?.name ?? 'Clinique'
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const patientName = `${patient.first_name} ${patient.last_name}`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Dossier patient — ${patientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 14px; color: #1a1a1a; background: white; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 22px; font-weight: bold; color: #0F172A; }
  h2 { font-size: 16px; font-weight: bold; color: #0F172A; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #0596DE; }
  h3 { font-size: 14px; font-weight: bold; color: #374151; margin: 16px 0 6px; }
  p { line-height: 1.7; color: #374151; margin-bottom: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0F172A; }
  .clinic-name { font-size: 20px; font-weight: bold; color: #0F172A; }
  .badge { display: inline-block; background: #EFF6FF; color: #1D4ED8; font-size: 12px; font-weight: bold; padding: 2px 10px; border-radius: 99px; margin-left: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .info-item { background: #F8FAFC; padding: 12px 14px; border-radius: 8px; }
  .info-label { font-size: 11px; font-weight: bold; color: #6B7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
  .info-value { font-size: 14px; color: #111827; font-weight: 500; }
  .consultation { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .consultation-date { font-size: 12px; color: #6B7280; margin-bottom: 6px; }
  .field-block { margin-bottom: 10px; }
  .field-label { font-size: 11px; font-weight: bold; color: #0596DE; text-transform: uppercase; letter-spacing: .05em; }
  .field-value { font-size: 13px; color: #374151; line-height: 1.6; }
  .document-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; }
  .alert { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="clinic-name">${clinicName}</div>
      <div style="font-size:13px;color:#6B7280;margin-top:4px">Dossier médical patient</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:bold;color:#0F172A">${patientName}</div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px">Généré le ${today}</div>
    </div>
  </div>

  <h2>📋 Informations patient</h2>
  <div class="info-grid">
    ${patient.date_of_birth ? `<div class="info-item"><div class="info-label">Date de naissance</div><div class="info-value">${new Date(patient.date_of_birth).toLocaleDateString('fr-FR')}</div></div>` : ''}
    ${patient.email ? `<div class="info-item"><div class="info-label">Email</div><div class="info-value">${patient.email}</div></div>` : ''}
    ${patient.phone ? `<div class="info-item"><div class="info-label">Téléphone</div><div class="info-value">${patient.phone}</div></div>` : ''}
    <div class="info-item"><div class="info-label">Source</div><div class="info-value">${patient.source === 'doctolib' ? 'Doctolib' : 'Manuel'}</div></div>
    ${patient.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Notes</div><div class="info-value">${patient.notes}</div></div>` : ''}
  </div>

  ${journey ? `
  <h2>🗺️ Parcours de soin</h2>
  <div class="info-item" style="margin-bottom:16px">
    <div class="info-label">Traitement</div>
    <div class="info-value">${journey.treatment?.name ?? '—'}</div>
    <div style="margin-top:6px;font-size:12px;color:#6B7280">Étape : ${journey.stage}</div>
  </div>
  ` : ''}

  ${consultations && consultations.length > 0 ? `
  <h2>🩺 Consultations (${consultations.length})</h2>
  ${consultations.map((c: any) => {
    const structured = c.structured_data ?? {}
    const fields = [
      ['Motif', structured.motif_consultation],
      ['Diagnostic', structured.diagnostic],
      ['Plan de traitement', structured.plan_de_traitement],
      ['Antécédents', structured.antecedents],
      ['Allergies', structured.allergies],
      ['Médicaments', structured.medicaments],
      ['Notes', structured.notes],
      ['Compte-rendu IA', structured.compte_rendu_ia],
    ].filter(([, v]) => v)

    return `<div class="consultation">
      <div class="consultation-date">${new Date(c.consultation_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}${c.treatment ? ` — ${c.treatment.name}` : ''}${c.acte_type ? ` — ${c.acte_type}` : ''}</div>
      ${fields.map(([label, value]) => `
        <div class="field-block">
          <div class="field-label">${label}</div>
          <div class="field-value">${String(value)}</div>
        </div>
      `).join('')}
      ${fields.length === 0 ? '<p style="color:#9CA3AF;font-size:12px">Aucune donnée structurée</p>' : ''}
    </div>`
  }).join('')}
  ` : ''}

  ${documents && documents.length > 0 ? `
  <h2>📄 Documents générés (${documents.length})</h2>
  ${documents.map((d: any) => `
    <div class="document-row">
      <div>
        <span style="font-size:13px;font-weight:500">${d.name}</span>
        <span class="badge">${d.type}</span>
      </div>
      <div style="font-size:12px;color:#6B7280;display:flex;gap:10px;align-items:center">
        ${d.status === 'signed' ? '<span style="color:#059669;font-weight:600">✓ Signé</span>' : d.status}
        <span>${new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  `).join('')}
  ` : ''}

  ${appointments && appointments.length > 0 ? `
  <h2>📅 Rendez-vous (${appointments.length})</h2>
  ${appointments.map((a: any) => `
    <div class="document-row">
      <span style="font-size:13px">${new Date(a.appointment_date).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' })} à ${new Date(a.appointment_date).getHours()}h${String(new Date(a.appointment_date).getMinutes()).padStart(2,'0')}${a.treatment ? ` — ${a.treatment.name}` : ''}</span>
      <span style="font-size:12px;color:#6B7280">${a.status}</span>
    </div>
  `).join('')}
  ` : ''}

  <div class="footer">
    Dossier médical confidentiel — ${clinicName} — Généré par ClinicFlow AI le ${today}<br>
    Ce document est à usage médical exclusif. Ne pas diffuser sans accord du patient.
  </div>
</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="dossier-${patient.last_name}-${patient.first_name}.html"`,
    },
  })
}
