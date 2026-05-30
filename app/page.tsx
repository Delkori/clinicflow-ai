'use client'
import Link from 'next/link'
import { useState } from 'react'

const FEATURES = [
  { icon:'🎙️', title:'Consultation IA', desc:'Dictée vocale + transcription Whisper. Les champs se remplissent automatiquement. Compte-rendu généré en un clic.', color:'#0596DE' },
  { icon:'⚡', title:'Workflows automatisés', desc:'Builder visuel drag & drop. Email → WhatsApp → Signature → Délai → Condition. Aucun code requis.', color:'#7C3AED' },
  { icon:'📸', title:'Photos avant/après', desc:'Galerie par traitement, slider de comparaison interactif, partage sécurisé avec watermark clinique.', color:'#059669' },
  { icon:'📅', title:'Sync Doctolib', desc:'Import iCal automatique. Chaque nouveau RDV crée une fiche patient et déclenche le workflow associé.', color:'#D97706' },
  { icon:'✍️', title:'Signature électronique', desc:'Consentements éclairés générés avec les données patient, envoyés et signés via Yousign. 100% légal.', color:'#DC2626' },
  { icon:'💰', title:'Facturation & Stocks', desc:'Factures TVA avec actes CCAM, gestion des injectables et consommables, alertes de réapprovisionnement.', color:'#0891B2' },
  { icon:'🎁', title:'Programme de fidélité', desc:'Points automatiques à chaque soin, 4 paliers Bronze → Platinum, valeur convertible en remise.', color:'#EC4899' },
  { icon:'⭐', title:'Avis & Réputation', desc:'Demandez un avis Google ou Trustpilot après chaque consultation. Envoi WhatsApp ou email en 1 clic.', color:'#F59E0B' },
  { icon:'📊', title:'Analytics en temps réel', desc:'Sankey des traitements, CA mensuel, KPIs automatiques. Vos vraies données, pas des simulations.', color:'#6366F1' },
]

const PRICING = [
  { name:'Starter', price:'49', period:'mois', desc:'Pour un praticien solo', highlight:false, features:["1 praticien","Jusqu'à 200 patients","5 workflows","Booking public","Import Doctolib","Support email"], cta:'Commencer' },
  { name:'Pro', price:'99', period:'mois', desc:'Pour une clinique active', highlight:true, features:["Jusqu'à 5 praticiens","Jusqu'à 500 patients","Workflows illimités","🎙️ IA transcription","✍️ Signature Yousign","Sync iCal Doctolib auto","Support prioritaire"], cta:'Essai 14 jours' },
  { name:'Clinic', price:'199', period:'mois', desc:'Multi-sites & grandes équipes', highlight:false, features:["Praticiens illimités","Patients illimités","Multi-sites","API accès complet","Onboarding dédié","SLA 99.9%","Account manager"], cta:'Nous contacter' },
]

// Sankey data simulé pour la démo
const SANKEY_POLES = [
  { label:'Injections', color:'#7C3AED', pct:38, traitements:[
    { label:'Acide hyaluronique', pct:55, color:'#A78BFA' },
    { label:'Toxine botulinique', pct:30, color:'#8B5CF6' },
    { label:'Skinbooster', pct:15, color:'#C4B5FD' },
  ]},
  { label:'Laser & Bien-être', color:'#EC4899', pct:28, traitements:[
    { label:'Épilation laser', pct:50, color:'#F472B6' },
    { label:'IPL / Photorej.', pct:30, color:'#F9A8D4' },
    { label:'Cryolipolyse', pct:20, color:'#FBCFE8' },
  ]},
  { label:'Capillaire', color:'#D97706', pct:22, traitements:[
    { label:'Greffe FUE', pct:60, color:'#FBBF24' },
    { label:'PRP capillaire', pct:25, color:'#FCD34D' },
    { label:'Mésothérapie', pct:15, color:'#FDE68A' },
  ]},
  { label:'Chirurgie', color:'#059669', pct:12, traitements:[
    { label:'Rhinoplastie', pct:40, color:'#34D399' },
    { label:'Blépharoplastie', pct:35, color:'#6EE7B7' },
    { label:'Liposuccion', pct:25, color:'#A7F3D0' },
  ]},
]

function SankeyDemo() {
  const [hovered, setHovered] = useState<string|null>(null)
  const W = 700, H = 320
  const LEFT_W = 120, RIGHT_X = 460, RIGHT_W = 200
  const TOTAL_H = H - 60

  let poleY = 20
  const poleRects: Record<string,{y:number;h:number}> = {}
  SANKEY_POLES.forEach(pole => {
    const h = Math.round((pole.pct / 100) * TOTAL_H) - 8
    poleRects[pole.label] = { y: poleY, h }
    poleY += h + 8
  })

  let tratY = 10
  const tratRects: Record<string,{y:number;h:number}> = {}
  SANKEY_POLES.forEach(pole => {
    pole.traitements.forEach(t => {
      const h = Math.max(22, Math.round((pole.pct / 100) * (t.pct / 100) * TOTAL_H) - 4)
      tratRects[`${pole.label}-${t.label}`] = { y: tratY, h }
      tratY += h + 4
    })
  })

  const paths: { d:string; color:string; key:string; opacity:number }[] = []
  SANKEY_POLES.forEach(pole => {
    const pr = poleRects[pole.label]
    if (!pr) return
    let outY = pr.y
    pole.traitements.forEach(t => {
      const key = `${pole.label}-${t.label}`
      const tr = tratRects[key]
      if (!tr) return
      const srcH = Math.round((t.pct / 100) * pr.h)
      const cx = (LEFT_W + RIGHT_X) / 2
      const d = `M ${LEFT_W} ${outY} C ${cx} ${outY}, ${cx} ${tr.y}, ${RIGHT_X} ${tr.y}
        L ${RIGHT_X} ${tr.y + tr.h}
        C ${cx} ${tr.y + tr.h}, ${cx} ${outY + srcH}, ${LEFT_W} ${outY + srcH} Z`
      paths.push({ d, color: t.color, key, opacity: hovered === pole.label || hovered === null ? 0.5 : 0.15 })
      outY += srcH
    })
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:700, display:'block' }}>
      <text x={LEFT_W/2} y={12} textAnchor="middle" fontSize={9} fontWeight="700" fill="rgba(255,255,255,0.3)" fontFamily="-apple-system,sans-serif" letterSpacing="1">PÔLES</text>
      <text x={RIGHT_X + RIGHT_W/2} y={8} textAnchor="middle" fontSize={9} fontWeight="700" fill="rgba(255,255,255,0.3)" fontFamily="-apple-system,sans-serif" letterSpacing="1">TRAITEMENTS</text>
      {paths.map(p => <path key={p.key} d={p.d} fill={p.color} opacity={p.opacity} />)}
      {SANKEY_POLES.map(pole => {
        const r = poleRects[pole.label]
        if (!r) return null
        return (
          <g key={pole.label}
            onMouseEnter={() => setHovered(pole.label)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor:'pointer' }}>
            <rect x={0} y={r.y} width={LEFT_W} height={r.h} fill={pole.color} rx={6} opacity={hovered === pole.label || hovered === null ? 1 : 0.4} />
            <text x={LEFT_W/2} y={r.y + r.h/2 - 5} textAnchor="middle" fill="white" fontSize={10} fontWeight="700" fontFamily="-apple-system,sans-serif">{pole.label}</text>
            <text x={LEFT_W/2} y={r.y + r.h/2 + 9} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={9} fontFamily="-apple-system,sans-serif">{pole.pct}% du CA</text>
          </g>
        )
      })}
      {SANKEY_POLES.map(pole => pole.traitements.map(t => {
        const key = `${pole.label}-${t.label}`
        const r = tratRects[key]
        if (!r) return null
        return (
          <g key={key}>
            <rect x={RIGHT_X} y={r.y} width={5} height={r.h} fill={pole.color} rx={2} />
            <rect x={RIGHT_X + 9} y={r.y} width={RIGHT_W - 12} height={r.h} fill="rgba(255,255,255,0.07)" rx={5} />
            <text x={RIGHT_X + 16} y={r.y + r.h/2 - 4} fill="rgba(255,255,255,0.9)" fontSize={9} fontWeight="600" fontFamily="-apple-system,sans-serif">{t.label}</text>
            <text x={RIGHT_X + 16} y={r.y + r.h/2 + 7} fill="rgba(255,255,255,0.4)" fontSize={8} fontFamily="-apple-system,sans-serif">{t.pct}% du pôle</text>
            <rect x={RIGHT_X + RIGHT_W - 4} y={r.y} width={4} height={r.h} fill={t.color} rx={1} />
          </g>
        )
      }))}
    </svg>
  )
}

export default function HomePage() {
  return (
    <div style={{ fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color:'#0F172A', background:'white' }}>

      {/* Nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 24px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'#0596DE', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontWeight:800, fontSize:15, letterSpacing:'-0.3px' }}>ClinicFlow AI</span>
          <span style={{ fontSize:10, background:'#EFF6FF', color:'#0596DE', padding:'2px 6px', borderRadius:4, fontWeight:600 }}>BETA</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <a href="#pricing" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Tarifs</a>
          <Link href="/legal" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Mentions légales</Link>
          <Link href="/auth/login" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Connexion</Link>
          <Link href="/auth/signup" style={{ fontSize:13, fontWeight:600, color:'white', background:'#0596DE', borderRadius:8, padding:'7px 16px', textDecoration:'none' }}>Essai gratuit →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth:1100, margin:'0 auto', padding:'80px 24px 60px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:99, padding:'5px 14px', marginBottom:20 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#0596DE' }} />
          <span style={{ fontSize:12.5, fontWeight:600, color:'#0596DE' }}>Spécialisé médecine esthétique · Médecins + Cliniques</span>
        </div>
        <h1 style={{ fontSize:'clamp(32px, 5vw, 56px)', fontWeight:900, letterSpacing:'-1.5px', lineHeight:1.1, margin:'0 0 20px' }}>
          Le logiciel qui{' '}
          <span style={{ background:'linear-gradient(135deg, #0596DE, #7C3AED)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            travaille pour vous
          </span>
        </h1>
        <p style={{ fontSize:18, color:'#64748B', maxWidth:560, margin:'0 auto 36px', lineHeight:1.7 }}>
          De la consultation Doctolib au suivi J+365 — emails, WhatsApp, signatures, documents. Sans lever le petit doigt.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/auth/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 28px', background:'#0596DE', color:'white', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:15 }}>
            Essayer gratuitement <span style={{ fontSize:16 }}>→</span>
          </Link>
          <Link href="/auth/login" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 24px', background:'white', color:'#475569', border:'1px solid #E2E8F0', borderRadius:10, textDecoration:'none', fontWeight:500, fontSize:15 }}>
            Se connecter
          </Link>
        </div>
        <p style={{ fontSize:12, color:'#94A3B8', marginTop:12 }}>Aucune carte bancaire requise · 14 jours offerts · Résiliation en 1 clic</p>
      </section>

      {/* Sankey Dashboard Section */}
      <section style={{ background:'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)', padding:'64px 24px', overflow:'hidden' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#0596DE', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Tableau de bord intelligent</div>
            <h2 style={{ fontSize:32, fontWeight:800, color:'white', letterSpacing:'-0.5px', margin:'0 0 12px' }}>
              Visualisez votre activité en temps réel
            </h2>
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.55)', maxWidth:480, margin:'0 auto' }}>
              Le diagramme Sankey affiche automatiquement la répartition de vos traitements et revenus depuis les vraies données de votre clinique.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32, alignItems:'center' }}>
            {/* Sankey interactif */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'24px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>Répartition des traitements</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', background:'rgba(5,150,222,0.15)', padding:'2px 8px', borderRadius:99, border:'1px solid rgba(5,150,222,0.2)' }}>Données réelles clinique</span>
              </div>
              <SankeyDemo />
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:10, textAlign:'center' }}>Survolez un pôle pour isoler ses traitements</p>
            </div>

            {/* Features list */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { icon:'📊', title:'Analytics automatique', desc:'KPIs, CA mensuel, évolution des traitements — calculés depuis vos consultations réelles.', color:'#6366F1' },
                { icon:'⚡', title:'Workflows déclenchés auto', desc:'Chaque consultation déclenche le bon workflow : email J+1, WhatsApp J+7, bilan J+30...', color:'#0596DE' },
                { icon:'📸', title:'Suivi photos intégré', desc:'Avant/après par session, comparaison slider, partage sécurisé avec vos patients.', color:'#059669' },
                { icon:'💰', title:'Facturation en temps réel', desc:"CA du mois affiché sur le dashboard, factures TVA générées en 1 clic.", color:'#D97706' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'14px 16px', background:'rgba(255,255,255,0.04)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:`${item.color}20`, border:`1px solid ${item.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:3 }}>{item.title}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ background:'#F8FAFC', padding:'64px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px', margin:'0 0 10px' }}>Tout ce dont votre clinique a besoin</h2>
            <p style={{ fontSize:16, color:'#64748B' }}>Conçu avec et pour les médecins esthétiques</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
            {FEATURES.map((f,i) => (
              <div key={i} style={{ background:'white', borderRadius:14, padding:24, border:'1px solid #E2E8F0', transition:'all .15s', cursor:'default' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor=f.color+'40' }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='#E2E8F0' }}>
                <div style={{ fontSize:28, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:6, color:'#0F172A' }}>{f.title}</div>
                <div style={{ fontSize:13.5, color:'#64748B', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow builder preview */}
      <section style={{ background:'#0F172A', padding:'64px 24px', overflow:'hidden' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#0596DE', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Builder de workflows</div>
            <h2 style={{ fontSize:32, fontWeight:800, color:'white', letterSpacing:'-0.5px', margin:'0 0 14px' }}>
              Automatisez le suivi patient sans coder
            </h2>
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:24 }}>
              Glissez-déposez des nœuds sur le canvas : email, WhatsApp, délai, condition, signature, webhook... Créez des parcours sur 1 an en quelques minutes.
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Email', 'WhatsApp', 'Yousign', 'Webhook', 'Slack', 'Zapier', 'Make', 'Délai', 'Condition'].map(t => (
                <span key={t} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:99, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.1)' }}>{t}</span>
              ))}
            </div>
          </div>
          {/* Mini canvas mockup */}
          <div style={{ background:'#1E293B', borderRadius:16, padding:20, border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />)}
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginLeft:4 }}>Parcours Greffe FUE — The Clinic</span>
            </div>
            {[
              { icon:'⚡', label:'Consultation créée', color:'#D97706', bg:'rgba(217,119,6,0.15)' },
              { icon:'📋', label:'Formulaire anamnèse', color:'#0596DE', bg:'rgba(5,150,222,0.15)' },
              { icon:'💬', label:'WA bienvenue patient', color:'#059669', bg:'rgba(5,150,222,0.15)' },
              { icon:'✍️', label:'Envoyer pour signature', color:'#6B21A8', bg:'rgba(107,33,168,0.15)' },
              { icon:'⏰', label:'Attendre J-7', color:'#0596DE', bg:'rgba(5,150,222,0.15)' },
              { icon:'📧', label:'Email pré-opératoire', color:'#1D4ED8', bg:'rgba(29,78,216,0.15)' },
            ].map((n,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:n.bg, borderRadius:8, marginBottom:6, border:`1px solid ${n.color}25` }}>
                <span style={{ fontSize:14 }}>{n.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:n.color }}>{n.label}</span>
                {i < 5 && <div style={{ marginLeft:'auto', width:16, height:16, borderRadius:'50%', background:n.color, opacity:.4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white' }}>↓</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding:'64px 24px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px', margin:'0 0 10px' }}>Tarifs simples et transparents</h2>
            <p style={{ fontSize:16, color:'#64748B' }}>Sans engagement · Résiliez quand vous voulez</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {PRICING.map((plan,i) => (
              <div key={i} style={{ borderRadius:16, padding:28, border:`2px solid ${plan.highlight ? '#0596DE' : '#E2E8F0'}`, position:'relative', background: plan.highlight ? '#EFF6FF' : 'white' }}>
                {plan.highlight && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#0596DE', color:'white', fontSize:11, fontWeight:700, padding:'4px 14px', borderRadius:99, whiteSpace:'nowrap' }}>⭐ Plus populaire</div>}
                <div style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:4 }}>{plan.name}</div>
                <div style={{ fontSize:12, color:'#64748B', marginBottom:16 }}>{plan.desc}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:20 }}>
                  <span style={{ fontSize:38, fontWeight:900, color:'#0F172A', letterSpacing:'-1px' }}>{plan.price}€</span>
                  <span style={{ fontSize:13, color:'#94A3B8' }}>/{plan.period}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
                  {plan.features.map((f,j) => (
                    <div key={j} style={{ display:'flex', gap:8, fontSize:13, color:'#475569' }}>
                      <span style={{ color:'#0596DE', flexShrink:0, fontWeight:700 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <Link href="/auth/signup" style={{ display:'block', textAlign:'center', padding:'11px', borderRadius:10, background: plan.highlight ? '#0596DE' : '#0F172A', color:'white', textDecoration:'none', fontWeight:700, fontSize:14 }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'60px 24px', textAlign:'center' }}>
        <h2 style={{ fontSize:30, fontWeight:800, color:'white', letterSpacing:'-0.5px', margin:'0 0 12px' }}>Prêt à automatiser votre clinique ?</h2>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.55)', marginBottom:28 }}>Rejoignez les praticiens qui ont automatisé leur suivi patient</p>
        <Link href="/auth/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 28px', background:'#0596DE', color:'white', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:15 }}>
          Commencer gratuitement →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ background:'#0F172A', borderTop:'1px solid rgba(255,255,255,0.07)', padding:'24px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', gap:24, marginBottom:12 }}>
          <Link href="/legal" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>Mentions légales</Link>
          <Link href="/legal#cgu" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>CGU</Link>
          <Link href="/legal#privacy" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>Politique de confidentialité</Link>
          <Link href="/legal#dpa" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>DPA</Link>
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', margin:0 }}>© {new Date().getFullYear()} ClinicFlow AI · Tous droits réservés</p>
      </footer>
    </div>
  )
}
