import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')
const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM  = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886'

Deno.serve(async (req) => {
  const now = new Date()
  console.log(`[workflow-cron] Running at ${now.toISOString()}`)

  try {
    // Get all pending executions scheduled for now or earlier
    const { data: pending, error } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        step:workflow_steps(type, template_name, template_subject, template_body, timing_days),
        patient:patients(id, first_name, last_name, email, phone, clinic_id),
        clinic:clinics(name)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .limit(50)

    if (error) throw error
    if (!pending?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'Nothing to process' }), { status: 200 })
    }

    console.log(`[workflow-cron] ${pending.length} executions to process`)
    let processed = 0, failed = 0

    for (const exec of pending) {
      const step = exec.step
      const patient = exec.patient
      const clinicName = exec.clinic?.name ?? 'Votre Clinique'

      if (!step || !patient) {
        await supabase.from('workflow_executions')
          .update({ status: 'skipped', error_message: 'Missing step or patient data' })
          .eq('id', exec.id)
        continue
      }

      const vars: Record<string, string> = {
        patient_name: `${patient.first_name} ${patient.last_name}`,
        first_name: patient.first_name,
        last_name: patient.last_name,
        clinic_name: clinicName,
        email: patient.email ?? '',
        phone: patient.phone ?? '',
      }

      const body = interpolate(step.template_body ?? '', vars)
      const subject = interpolate(step.template_subject ?? `Message de ${clinicName}`, vars)

      let success = false
      let errorMsg = ''

      try {
        if (step.type === 'email' && patient.email) {
          success = await sendEmail(patient.email, subject, body, clinicName, `${patient.first_name} ${patient.last_name}`)
        } else if (step.type === 'whatsapp' && patient.phone) {
          success = await sendWhatsApp(patient.phone, body)
        } else if (step.type === 'notification') {
          // Internal notification — just mark as sent
          success = true
        } else {
          // Can't process, mark as skipped
          await supabase.from('workflow_executions')
            .update({ status: 'skipped', error_message: `No ${step.type} config or missing data` })
            .eq('id', exec.id)
          continue
        }
      } catch (e: any) {
        errorMsg = e.message
      }

      await supabase.from('workflow_executions')
        .update({
          status: success ? 'sent' : 'failed',
          executed_at: success ? now.toISOString() : null,
          error_message: errorMsg || null,
        })
        .eq('id', exec.id)

      if (success) {
        processed++
        await supabase.from('automation_logs').insert({
          clinic_id: patient.clinic_id,
          patient_id: patient.id,
          execution_id: exec.id,
          action: `${step.type}_auto`,
          channel: step.type,
          status: 'success',
          metadata: { template: step.template_name, cron: true },
        })
      } else {
        failed++
      }
    }

    console.log(`[workflow-cron] Done: ${processed} sent, ${failed} failed`)
    return new Response(JSON.stringify({ processed, failed, total: pending.length }), { status: 200 })

  } catch (err: any) {
    console.error('[workflow-cron] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

async function sendEmail(to: string, subject: string, body: string, clinicName: string, patientName: string): Promise<boolean> {
  if (!RESEND_KEY || RESEND_KEY === 'your_resend_api_key_here') return true // demo

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <div style="background:#0F172A;color:white;padding:20px 24px;border-radius:10px 10px 0 0">
      <strong>${clinicName}</strong>
    </div>
    <div style="background:white;padding:28px;border:1px solid #E2E8F0;border-radius:0 0 10px 10px">
      <h2 style="font-size:18px;color:#0F172A;margin:0 0 16px">${subject}</h2>
      <div style="font-size:14px;color:#475569;line-height:1.8;white-space:pre-wrap">${body}</div>
    </div>
  </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: `${clinicName} <onboarding@resend.dev>`, to: [to], subject, html, text: body }),
  })
  return res.ok
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || TWILIO_SID === 'your_twilio_sid_here') return true // demo

  let normalizedPhone = phone.replace(/\s/g, '').replace(/^00/, '+')
  if (!normalizedPhone.startsWith('+')) normalizedPhone = '+33' + normalizedPhone.replace(/^0/, '')

  const body = new URLSearchParams({ From: TWILIO_FROM, To: `whatsapp:${normalizedPhone}`, Body: message })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
    },
    body,
  })
  return res.ok
}
