import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const { clinic_id } = await request.json()
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('your_stripe')) {
    return NextResponse.json({ simulated: true, portal_url: '/dashboard/billing' })
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('clinic_id', clinic_id).single()
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: 'No customer' }, { status: 404 })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clinicflow-ai-delkoris-projects.vercel.app'
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/dashboard/billing`,
  })
  return NextResponse.json({ portal_url: session.url })
}
