import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PLANS: Record<string, { price_id: string; name: string; amount: number }> = {
  starter: {
    price_id: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
    name: 'ClinicFlow Starter',
    amount: 4900, // 49€
  },
  pro: {
    price_id: process.env.STRIPE_PRICE_PRO ?? 'price_pro',
    name: 'ClinicFlow Pro',
    amount: 9900, // 99€
  },
  clinic: {
    price_id: process.env.STRIPE_PRICE_CLINIC ?? 'price_clinic',
    name: 'ClinicFlow Clinic',
    amount: 19900, // 199€
  },
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { plan, clinic_id, success_url, cancel_url } = await request.json()

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('your_stripe')) {
      // Demo mode
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans vos variables d\'environnement',
        checkout_url: cancel_url,
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' })
    const supabase = getSupabase()
    const planConfig = PLANS[plan]
    if (!planConfig) return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })

    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('clinic_id', clinic_id)
      .single()

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinic_id)
      .single()

    let customerId = sub?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: clinic?.name ?? 'Clinique',
        metadata: { clinic_id },
      })
      customerId = customer.id
      await supabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('clinic_id', clinic_id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clinicflow-ai-delkoris-projects.vercel.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: planConfig.name },
          unit_amount: planConfig.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: success_url ?? `${appUrl}/dashboard/billing?success=1`,
      cancel_url: cancel_url ?? `${appUrl}/dashboard/billing`,
      metadata: { clinic_id, plan },
      subscription_data: { metadata: { clinic_id, plan } },
      locale: 'fr',
    })

    return NextResponse.json({ checkout_url: session.url, session_id: session.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
