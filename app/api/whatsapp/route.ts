import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { execution_id, patient_id, message, phone, clinic_id } = await request.json()
    if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const supabase = getSupabase()
    let normalizedPhone = phone.replace(/\s/g, '').replace(/^00/, '+')
    if (!normalizedPhone.startsWith('+')) normalizedPhone = '+33' + normalizedPhone.replace(/^0/, '')

    // SaaS: fetch per-clinic Twilio credentials
    let accountSid: string | undefined = process.env.TWILIO_ACCOUNT_SID
    let authToken: string | undefined = process.env.TWILIO_AUTH_TOKEN
    let fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

    if (clinic_id) {
      const { data: integration } = await supabase
        .from('clinic_integrations')
        .select('config')
        .eq('clinic_id', clinic_id)
        .eq('provider', 'twilio')
        .eq('is_active', true)
        .single()
      if (integration?.config?.account_sid) {
        accountSid = integration.config.account_sid
        authToken = integration.config.auth_token
        if (integration.config.whatsapp_from) fromNumber = integration.config.whatsapp_from
      }
    }

    if (!accountSid || !authToken) {
      // Simulation mode — mark as sent anyway for demo
      if (execution_id) {
        await supabase.from('workflow_executions').update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          error_message: 'Mode simulation — configurez Twilio dans Paramètres → Intégrations',
        }).eq('id', execution_id)
      }
      await supabase.from('automation_logs').insert({
        clinic_id, patient_id,
        action: 'whatsapp_simulated', channel: 'whatsapp', status: 'success',
        metadata: { phone: normalizedPhone, message, simulation: true },
      })
      return NextResponse.json({ success: true, simulated: true, phone: normalizedPhone })
    }

    // Real Twilio send
    const body = new URLSearchParams({
      From: fromNumber,
      To: `whatsapp:${normalizedPhone}`,
      Body: message,
    })
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body,
      }
    )
    const result = await response.json()

    if (!response.ok) {
      if (execution_id) await supabase.from('workflow_executions').update({ status: 'failed', error_message: result.message }).eq('id', execution_id)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    if (execution_id) await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', execution_id)
    await supabase.from('automation_logs').insert({
      clinic_id, patient_id,
      action: 'whatsapp_sent', channel: 'whatsapp', status: 'success',
      metadata: { phone: normalizedPhone, message, twilio_sid: result.sid },
    })

    return NextResponse.json({ success: true, sid: result.sid, phone: normalizedPhone })
  } catch (error) {
    console.error('WhatsApp error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
