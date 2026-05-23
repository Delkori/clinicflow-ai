import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export type WebhookEvent =
  | 'patient.created'
  | 'consultation.created'
  | 'consultation.completed'
  | 'journey.stage_changed'
  | 'document.signed'
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'workflow.step_sent'

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const { event, clinic_id, data } = await request.json()
    const supabase = getSupabase()

    // Find active webhooks for this clinic + event
    const { data: webhooks } = await supabase
      .from('webhook_integrations')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true)
      .eq('direction', 'outbound')
      .contains('events', [event])

    if (!webhooks?.length) {
      return NextResponse.json({ fired: 0, message: 'No webhooks configured for this event' })
    }

    const results = []

    for (const webhook of webhooks) {
      const payload = buildPayload(webhook, event, data)
      let status = 0
      let responseBody = ''
      let error = null

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-ClinicFlow-Event': event,
          'X-ClinicFlow-Timestamp': new Date().toISOString(),
          ...(webhook.headers ?? {}),
        }
        if (webhook.secret) {
          headers['X-ClinicFlow-Signature'] = webhook.secret
        }

        const res = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        })

        status = res.status
        responseBody = await res.text().catch(() => '')

        // Update webhook stats
        await supabase.from('webhook_integrations').update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: (webhook.trigger_count ?? 0) + 1,
        }).eq('id', webhook.id)

      } catch (err: any) {
        error = err.message
        status = 0
      }

      // Log
      await supabase.from('webhook_logs').insert({
        clinic_id,
        webhook_id: webhook.id,
        event,
        direction: 'outbound',
        payload,
        response_status: status,
        response_body: responseBody.slice(0, 1000),
        error,
        duration_ms: Date.now() - start,
      })

      results.push({ webhook_name: webhook.name, status, error })
    }

    return NextResponse.json({ fired: results.length, results })
  } catch (err) {
    return NextResponse.json({ error: 'Webhook trigger failed' }, { status: 500 })
  }
}

function buildPayload(webhook: any, event: string, data: any) {
  // If custom template, merge it
  const template = webhook.payload_template ?? {}
  if (Object.keys(template).length > 0) {
    return { ...template, event, data, timestamp: new Date().toISOString() }
  }
  // Default ClinicFlow payload shape
  return {
    event,
    timestamp: new Date().toISOString(),
    source: 'clinicflow',
    data,
  }
}
