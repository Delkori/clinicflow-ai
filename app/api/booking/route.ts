import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clinic_id, booking_setting_id,
      first_name, last_name, email, phone,
      requested_date, requested_time,
      appointment_type, treatment_id, notes,
    } = body

    const supabase = getSupabase()

    // Save booking request
    const { data: booking, error } = await supabase
      .from('booking_requests')
      .insert({
        clinic_id, booking_setting_id: booking_setting_id ?? null,
        first_name, last_name, email, phone: phone || null,
        requested_date, requested_time,
        appointment_type: appointment_type ?? 'consultation',
        treatment_id: treatment_id || null,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    // Check if patient already exists in the clinic
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('email', email)
      .eq('clinic_id', clinic_id)
      .maybeSingle()

    // Create patient if doesn't exist
    if (!existingPatient) {
      await supabase.from('patients').insert({
        clinic_id,
        first_name, last_name, email,
        phone: phone || null,
        source: 'other',
        notes: `Créé via prise de RDV en ligne`,
      })
    }

    // Send confirmation email via Resend if configured
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && resendKey !== 'your_resend_api_key_here' && email) {
      const { data: settings } = await supabase
        .from('booking_settings')
        .select('title, clinic:clinics(name)')
        .eq('id', booking_setting_id)
        .single()

      const clinicName = (settings as any)?.clinic?.name ?? 'Votre Clinique'
      const dateStr = new Date(requested_date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: `${clinicName} <onboarding@resend.dev>`,
          to: [email],
          subject: `Confirmation de votre demande de RDV — ${clinicName}`,
          html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="background:#0F172A;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
    <strong style="font-size:16px">${clinicName}</strong>
  </div>
  <div style="background:white;padding:28px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">
    <h2 style="font-size:18px;color:#0F172A;margin:0 0 12px">Votre demande est bien reçue ✅</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px">
      Bonjour <strong>${first_name}</strong>,<br>
      Nous avons bien reçu votre demande de rendez-vous pour le <strong>${dateStr} à ${requested_time}</strong>.
    </p>
    <div style="background:#F8FAFC;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Récapitulatif</div>
      <div style="font-size:14px;color:#0F172A"><strong>Date :</strong> ${dateStr} à ${requested_time}</div>
      <div style="font-size:14px;color:#0F172A;margin-top:4px"><strong>Type :</strong> ${appointment_type}</div>
    </div>
    <p style="color:#64748B;font-size:13px;">Notre équipe vous confirmera ce rendez-vous dans les <strong>24 heures</strong>.</p>
  </div>
</div>`,
        }),
      })
    }

    // Fire webhook if configured
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') ?? ''}/api/webhooks/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'appointment.created',
        clinic_id,
        data: { first_name, last_name, email, requested_date, requested_time, appointment_type },
      }),
    }).catch(() => {}) // Non-blocking

    return NextResponse.json({ success: true, booking_id: booking.id })
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: err.message ?? 'Booking failed' }, { status: 500 })
  }
}
