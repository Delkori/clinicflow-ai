import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || stripeKey.includes('your_stripe')) {
    return NextResponse.json({ received: true, simulated: true })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' })
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const supabase = getSupabase()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      const clinicId = session.metadata?.clinic_id
      const plan = session.metadata?.plan
      if (clinicId && plan) {
        await supabase.from('subscriptions').update({
          plan,
          status: 'active',
          stripe_subscription_id: session.subscription as string,
          trial_ends_at: null,
        }).eq('clinic_id', clinicId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as any
      const clinicId = sub.metadata?.clinic_id
      if (clinicId) {
        await supabase.from('subscriptions').update({
          status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled',
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        }).eq('clinic_id', clinicId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any
      const clinicId = sub.metadata?.clinic_id
      if (clinicId) {
        await supabase.from('subscriptions').update({
          plan: 'trial',
          status: 'cancelled',
          stripe_subscription_id: null,
        }).eq('clinic_id', clinicId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
