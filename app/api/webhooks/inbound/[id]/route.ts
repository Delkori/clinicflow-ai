import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// POST /api/webhooks/inbound/[id] — receives payload from external apps
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    // Find the webhook config
    const { data: webhook } = await supabase
      .from('webhook_integrations')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

    // Verify secret if configured
    const secret = request.headers.get('x-webhook-secret') || request.headers.get('authorization')?.replace('Bearer ', '')
    if (webhook.secret && secret !== webhook.secret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    const body = await request.json()

    // Log inbound
    await supabase.from('webhook_logs').insert({
      clinic_id: webhook.clinic_id,
      webhook_id: webhook.id,
      event: body.event ?? 'inbound',
      direction: 'inbound',
      payload: body,
      response_status: 200,
    })

    // Update stats
    await supabase.from('webhook_integrations').update({
      last_triggered_at: new Date().toISOString(),
      trigger_count: (webhook.trigger_count ?? 0) + 1,
    }).eq('id', webhook.id)

    // Process common inbound actions
    if (body.action === 'create_patient') {
      const { data: existing } = await supabase.from('patients')
        .select('id').eq('email', body.email).eq('clinic_id', webhook.clinic_id).maybeSingle()

      if (!existing) {
        await supabase.from('patients').insert({
          clinic_id: webhook.clinic_id,
          first_name: body.first_name ?? '',
          last_name: body.last_name ?? '',
          email: body.email,
          phone: body.phone,
          source: 'other',
          notes: `Créé via webhook ${webhook.name}`,
        })
      }
    }

    if (body.action === 'create_appointment') {
      await supabase.from('appointments').insert({
        clinic_id: webhook.clinic_id,
        patient_id: body.patient_id,
        appointment_date: body.appointment_date,
        type: body.type ?? 'consultation',
        source: webhook.provider,
        notes: body.notes,
      })
    }

    return NextResponse.json({
      received: true,
      webhook: webhook.name,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: 'Inbound webhook error' }, { status: 500 })
  }
}
