import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export async function POST(request: NextRequest) {
  try {
    const { execution_id, patient_id, message, phone } = await request.json()
    if (!phone || !message) return NextResponse.json({ error: 'Phone and message required' }, { status: 400 })

    const supabase = getSupabase()
    let normalizedPhone = phone.replace(/\s/g, '').replace(/^00/, '+')
    if (!normalizedPhone.startsWith('+')) normalizedPhone = '+33' + normalizedPhone.replace(/^0/, '')

    const { data: patient } = await supabase.from('patients').select('clinic_id').eq('id', patient_id).single()
    const clinic_id = patient?.clinic_id

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

    if (!accountSid || !authToken || accountSid === 'your_twilio_sid_here') {
      // Demo mode
      if (execution_id) await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', execution_id)
      if (clinic_id) await supabase.from('automation_logs').insert({ clinic_id, patient_id, action: 'whatsapp_demo', channel: 'whatsapp', status: 'success', metadata: { phone: normalizedPhone, message, simulation: true } })
      return NextResponse.json({ success: true, simulated: true, phone: normalizedPhone })
    }

    const body = new URLSearchParams({ From: fromNumber, To: `whatsapp:${normalizedPhone}`, Body: message })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
      body,
    })
    const result = await res.json()
    if (!res.ok) {
      if (execution_id) await supabase.from('workflow_executions').update({ status: 'failed', error_message: result.message }).eq('id', execution_id)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    if (execution_id) await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', execution_id)
    if (clinic_id) await supabase.from('automation_logs').insert({ clinic_id, patient_id, action: 'whatsapp_sent', channel: 'whatsapp', status: 'success', metadata: { phone: normalizedPhone, message, sid: result.sid } })
    return NextResponse.json({ success: true, sid: result.sid, phone: normalizedPhone })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
