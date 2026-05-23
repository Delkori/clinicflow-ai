import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

function buildEmailHTML(subject: string, body: string, clinicName: string, patientName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);border-radius:16px 16px 0 0;padding:28px 32px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:#0596DE;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:white;font-size:16px">✦</span>
      </div>
      <div>
        <div style="color:white;font-weight:700;font-size:16px">${clinicName}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:12px">Propulsé par ClinicFlow AI</div>
      </div>
    </div>
    <!-- Body -->
    <div style="background:white;padding:32px;border:1px solid #E2E8F0;border-top:none">
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0F172A;letter-spacing:-0.3px">${subject}</h2>
      <div style="font-size:15px;line-height:1.7;color:#475569;white-space:pre-wrap">${body}</div>
    </div>
    <!-- Footer -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center">
      <p style="margin:0;font-size:12px;color:#94A3B8">Cet email a été envoyé à ${patientName} par ${clinicName}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#CBD5E1">ClinicFlow AI · Gestion intelligente du parcours patient</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    const {
      execution_id,
      patient_id,
      subject,
      body,
      template_name,
      attachments = [],
    } = await request.json()

    const supabase = getSupabase()

    // Load patient + clinic info
    const { data: patient } = await supabase
      .from('patients')
      .select('*, clinic:clinics(name)')
      .eq('id', patient_id)
      .single()

    if (!patient?.email) {
      return NextResponse.json({ error: 'Patient has no email address' }, { status: 400 })
    }

    const clinicName = (patient as any).clinic?.name ?? 'Votre Clinique'
    const patientName = `${patient.first_name} ${patient.last_name}`

    const vars = {
      patient_name: patientName,
      first_name: patient.first_name,
      last_name: patient.last_name,
      clinic_name: clinicName,
      email: patient.email,
      phone: patient.phone ?? '',
    }

    const finalSubject = interpolate(subject || 'Message de votre clinique', vars)
    const finalBody    = interpolate(body || '', vars)
    const htmlContent  = buildEmailHTML(finalSubject, finalBody, clinicName, patientName)

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'clinicflow@resend.dev'

    if (!resendKey || resendKey === 'your_resend_api_key_here') {
      // Demo mode — mark as sent but don't actually send
      if (execution_id) {
        await supabase.from('workflow_executions').update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          error_message: 'Demo mode - Resend not configured',
        }).eq('id', execution_id)
      }
      await supabase.from('automation_logs').insert({
        clinic_id: patient.clinic_id,
        patient_id,
        action: 'email_demo',
        channel: 'email',
        status: 'success',
        metadata: { to: patient.email, subject: finalSubject, simulation: true },
      })
      return NextResponse.json({ success: true, simulated: true, to: patient.email })
    }

    // Real send via Resend
    const emailPayload: any = {
      from: `${clinicName} <${fromEmail}>`,
      to: [patient.email],
      subject: finalSubject,
      html: htmlContent,
      text: finalBody,
    }

    if (attachments.length > 0) {
      emailPayload.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content, // base64
      }))
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(emailPayload),
    })

    const result = await res.json()

    if (!res.ok) {
      if (execution_id) {
        await supabase.from('workflow_executions').update({
          status: 'failed',
          error_message: result.message ?? 'Resend error',
        }).eq('id', execution_id)
      }
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    if (execution_id) {
      await supabase.from('workflow_executions').update({
        status: 'sent',
        executed_at: new Date().toISOString(),
      }).eq('id', execution_id)
    }

    await supabase.from('automation_logs').insert({
      clinic_id: patient.clinic_id,
      patient_id,
      action: 'email_sent',
      channel: 'email',
      status: 'success',
      metadata: { to: patient.email, subject: finalSubject, resend_id: result.id },
    })

    return NextResponse.json({ success: true, id: result.id, to: patient.email })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
