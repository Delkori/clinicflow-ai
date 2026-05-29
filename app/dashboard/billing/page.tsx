'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 49,
    icon: '🌱', color: '#0596DE', bg: '#EFF6FF',
    desc: 'Parfait pour démarrer',
    features: [
      '1 praticien',
      "Jusqu'à 200 patients",
      '5 workflows',
      'Prise de RDV en ligne',
      'Import Doctolib CSV',
      'Support email',
    ],
  },
  {
    id: 'pro', name: 'Pro', price: 99,
    icon: '⚡', color: '#7C3AED', bg: '#FAF5FF',
    desc: 'Pour une clinique active',
    highlight: true,
    features: [
      "Jusqu'à 5 praticiens",
      'Jusqu\'à 500 patients',
      'Workflows illimités',
      '🎙️ IA transcription incluse',
      '✍️ Signature Yousign incluse',
      'Sync iCal Doctolib auto',
      'Support prioritaire',
    ],
  },
  {
    id: 'clinic', name: 'Clinic', price: 199,
    icon: '🏥', color: '#059669', bg: '#F0FDF4',
    desc: 'Multi-sites & équipes larges',
    features: [
      'Praticiens illimités',
      'Multi-sites',
      'API accès complet',
      'Onboarding dédié',
      'SLA 99.9%',
      'Account manager',
    ],
  },
]

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <BillingContent />
    </Suspense>
  )
}

function BillingContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<any>(null)
  const [clinicId, setClinicId] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string|null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const justPaid = searchParams.get('success') === '1'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('clinic_id', prof.clinic_id).single()
      setSubscription(sub)
      setLoading(false)
    }
    load()
  }, [])

  async function startCheckout(planId: string) {
    setCheckoutLoading(planId)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId, clinic_id: clinicId }),
    })
    const data = await res.json()
    if (data.simulated) {
      alert(`Mode démo — Stripe non configuré.\n\nPour activer les paiements :\n1. Créez un compte sur stripe.com\n2. Ajoutez STRIPE_SECRET_KEY dans vos variables Vercel\n3. Configurez le webhook`)
    } else if (data.checkout_url) {
      window.location.href = data.checkout_url
    }
    setCheckoutLoading(null)
  }

  async function openPortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_id: clinicId }),
    })
    const data = await res.json()
    if (data.portal_url) window.location.href = data.portal_url
    setPortalLoading(false)
  }

  const currentPlan = PLANS.find(p => p.id === subscription?.plan) ?? PLANS[0]
  const isTrialing = subscription?.status === 'trialing'
  const daysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Abonnement & Facturation</div>
        <div className="page-subtitle">Gérez votre plan ClinicFlow AI</div>
      </div>

      <div className="page-content" style={{ maxWidth:900 }}>

        {/* Success banner */}
        {justPaid && (
          <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ fontSize:24 }}>🎉</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#166534' }}>Paiement confirmé !</div>
              <div style={{ fontSize:13, color:'#166534', opacity:.8 }}>Votre abonnement est maintenant actif. Toutes les fonctionnalités sont débloquées.</div>
            </div>
          </div>
        )}

        {/* Current plan card */}
        <div className="card" style={{ padding:24, marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:currentPlan.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{currentPlan.icon}</div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:17, fontWeight:700, color:'var(--gray-900)' }}>Plan {currentPlan.name}</span>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, background: isTrialing ? '#FFFBEB' : subscription?.status === 'active' ? '#F0FDF4' : '#FEF2F2', color: isTrialing ? '#D97706' : subscription?.status === 'active' ? '#059669' : '#DC2626' }}>
                    {isTrialing ? `Essai — ${daysLeft}j restants` : subscription?.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div style={{ fontSize:13, color:'var(--gray-500)', marginTop:3 }}>
                  {isTrialing
                    ? `Accès complet pendant l'essai — expire le ${new Date(subscription.trial_ends_at).toLocaleDateString('fr-FR')}`
                    : subscription?.current_period_end
                      ? `Prochain paiement : ${new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}`
                      : 'Plan gratuit'}
                </div>
              </div>
            </div>
            {subscription?.stripe_subscription_id && (
              <button onClick={openPortal} disabled={portalLoading} className="btn-secondary" style={{ fontSize:13 }}>
                {portalLoading ? '...' : '⚙ Gérer la facturation'}
              </button>
            )}
          </div>

          {isTrialing && daysLeft <= 7 && (
            <div style={{ marginTop:16, padding:'12px 14px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:9, fontSize:13, color:'#92400E', display:'flex', gap:8 }}>
              <span>⚠️</span>
              <span>Votre essai se termine dans <strong>{daysLeft} jour{daysLeft > 1 ? 's' : ''}</strong>. Passez à un plan payant pour conserver l'accès.</span>
            </div>
          )}
        </div>

        {/* Plans */}
        <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-800)', marginBottom:14 }}>Changer de plan</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {PLANS.map(plan => {
            const isCurrent = subscription?.plan === plan.id && !isTrialing
            return (
              <div key={plan.id} style={{ borderRadius:14, padding:24, border:`2px solid ${plan.highlight ? plan.color : isCurrent ? plan.color : 'var(--gray-200)'}`, background: plan.highlight ? plan.bg : isCurrent ? plan.bg : 'white', position:'relative' }}>
                {plan.highlight && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.color, color:'white', fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:99, whiteSpace:'nowrap' }}>
                    ⭐ Plus populaire
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#059669', color:'white', fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:99, whiteSpace:'nowrap' }}>
                    ✓ Plan actuel
                  </div>
                )}
                <div style={{ fontSize:22, marginBottom:8 }}>{plan.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--gray-900)', marginBottom:3 }}>{plan.name}</div>
                <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:12 }}>{plan.desc}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:16 }}>
                  <span style={{ fontSize:32, fontWeight:900, color:'var(--gray-900)', letterSpacing:'-1px' }}>{plan.price}€</span>
                  <span style={{ fontSize:12, color:'var(--gray-400)' }}>/mois</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:20 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display:'flex', gap:8, fontSize:12.5, color:'var(--gray-600)', alignItems:'flex-start' }}>
                      <span style={{ color:plan.color, flexShrink:0, fontWeight:700, marginTop:1 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => !isCurrent && startCheckout(plan.id)}
                  disabled={isCurrent || checkoutLoading === plan.id}
                  style={{ width:'100%', padding:'10px', borderRadius:9, border:'none', background: isCurrent ? 'var(--gray-200)' : plan.color, color: isCurrent ? 'var(--gray-500)' : 'white', fontSize:13, fontWeight:700, cursor: isCurrent ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {checkoutLoading === plan.id ? (
                    <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Redirection...</>
                  ) : isCurrent ? 'Plan actuel' : `Passer à ${plan.name}`}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </button>
              </div>
            )
          })}
        </div>

        {/* Setup instructions */}
        <div className="card" style={{ padding:20, marginTop:20 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <span>💳</span> Configurer Stripe pour les paiements réels
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { step:'1', text:'Créez un compte sur stripe.com et récupérez votre clé secrète (sk_live_...)' },
              { step:'2', text:'Dans Vercel → Settings → Environment Variables, ajoutez STRIPE_SECRET_KEY' },
              { step:'3', text:'Créez 3 produits dans Stripe et ajoutez STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_CLINIC' },
              { step:'4', text:'Configurez le webhook Stripe vers /api/stripe/webhook et ajoutez STRIPE_WEBHOOK_SECRET' },
            ].map(s => (
              <div key={s.step} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--blue)', color:'white', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{s.step}</div>
                <span style={{ fontSize:13, color:'var(--gray-600)', lineHeight:1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
          <a href="https://dashboard.stripe.com" target="_blank" style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:12, fontSize:13, color:'var(--blue)', textDecoration:'none', fontWeight:600 }}>
            Ouvrir Stripe Dashboard ↗
          </a>
        </div>
      </div>
    </div>
  )
}
