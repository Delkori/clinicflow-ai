import Link from 'next/link'

const FEATURES = [
  { icon:'🎙️', title:'Consultation IA', desc:'Dictée vocale + transcription Whisper. Les champs se remplissent seuls : Hamilton-Norwood, Glogau, zones HA, unités Botox.' },
  { icon:'⚡', title:'Workflows automatiques', desc:'Builder visuel n8n-like. Email → WhatsApp → PDF → Signature → Délai → Condition. Connectez vos apps en glisser-déposer.' },
  { icon:'📸', title:'Photos avant/après', desc:"Galerie par traitement, comparaison côte-à-côte, lien de partage sécurisé à envoyer au patient." },
  { icon:'📅', title:'Sync Doctolib', desc:"Import iCal automatique. Chaque nouveau RDV Doctolib crée la fiche patient et envoie le formulaire d'anamnèse." },
  { icon:'✍️', title:'Signature électronique', desc:'Consentements éclairés envoyés et signés via Yousign. Conformité légale, zéro papier.' },
  { icon:'🔗', title:'Intégrations tierces', desc:'Connectez n8n, Zapier, Make, Slack, Google Sheets ou n\'importe quelle URL webhook.' },
]

const STEPS = [
  { n:'01', title:'Le patient prend RDV', desc:'Sur Doctolib ou votre page de réservation ClinicFlow. Ses infos arrivent automatiquement.' },
  { n:'02', title:'Il complète son dossier', desc:"Reçoit un lien formulaire sur son téléphone. Remplit antécédents, allergies, médicaments avant d'arriver." },
  { n:'03', title:'La consultation', desc:"Dictez pendant l'examen. L'IA transcrit et structure les données dans les bons champs." },
  { n:'04', title:'Le workflow se déclenche', desc:'Consentement généré et envoyé pour signature. Email post-op à J+1, J+7, J+30. Tout automatique.' },
]

const PRICING = [
  { name:'Starter', price:'49', period:'mois', desc:'Pour un praticien solo', features:['1 praticien','Patients illimités','Workflows ×5','Booking public','Support email'], cta:'Commencer', highlight:false },
  { name:'Pro', price:'99', period:'mois', desc:'Pour une clinique', features:['Jusqu\'à 5 praticiens','Patients illimités','Workflows illimités','IA transcription','Signature Yousign incluse','Support prioritaire'], cta:'Essai 14 jours', highlight:true },
  { name:'Clinic', price:'199', period:'mois', desc:'Multi-sites', features:['Praticiens illimités','Multi-sites','API accès complet','Onboarding dédié','SLA 99.9%','Account manager'], cta:'Nous contacter', highlight:false },
]

export default function HomePage() {
  return (
    <div style={{ fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color:'#0F172A', background:'white' }}>

      {/* Nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'#0596DE', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontWeight:800, fontSize:15, letterSpacing:'-0.3px' }}>ClinicFlow AI</span>
          <span style={{ fontSize:10, background:'#EFF6FF', color:'#0596DE', padding:'2px 6px', borderRadius:4, fontWeight:700 }}>BETA</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <a href="#pricing" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Tarifs</a>
          <Link href="/legal" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Légal</Link>
          <Link href="/auth/login" style={{ fontSize:13, color:'#64748B', textDecoration:'none', padding:'6px 12px' }}>Connexion</Link>
          <Link href="/auth/signup" style={{ fontSize:13, fontWeight:600, color:'white', background:'#0596DE', borderRadius:8, padding:'7px 16px', textDecoration:'none' }}>Essai gratuit →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth:1100, margin:'0 auto', padding:'80px 24px 60px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:99, padding:'5px 14px', marginBottom:24 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#0596DE' }} />
          <span style={{ fontSize:12.5, fontWeight:600, color:'#0596DE' }}>Spécialisé médecine esthétique · Workflows automatiques</span>
        </div>
        <h1 style={{ fontSize:'clamp(32px, 5vw, 56px)', fontWeight:900, letterSpacing:'-1.5px', lineHeight:1.08, margin:'0 0 20px', maxWidth:750, marginLeft:'auto', marginRight:'auto' }}>
          Le logiciel qui <span style={{ background:'linear-gradient(135deg, #0596DE, #7C3AED)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>automatise</span> votre clinique esthétique
        </h1>
        <p style={{ fontSize:18, color:'#64748B', maxWidth:560, margin:'0 auto 36px', lineHeight:1.7 }}>
          De la consultation Doctolib au suivi J+365 — emails, WhatsApp, signatures, documents. Sans cliquer.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/auth/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 28px', background:'#0596DE', color:'white', borderRadius:10, fontSize:15, fontWeight:700, textDecoration:'none', boxShadow:'0 8px 24px rgba(5,150,222,0.35)', transition:'all .15s' }}>
            Essayer gratuitement <span style={{ fontSize:16 }}>→</span>
          </Link>
          <Link href="/auth/login" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 28px', background:'white', color:'#0F172A', borderRadius:10, fontSize:15, fontWeight:600, textDecoration:'none', border:'1.5px solid #E2E8F0' }}>
            Se connecter
          </Link>
        </div>
        <p style={{ fontSize:12, color:'#94A3B8', marginTop:12 }}>Aucune carte bancaire requise · 14 jours d'essai</p>
      </section>

      {/* Features grid */}
      <section style={{ background:'#F8FAFC', padding:'64px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px', margin:'0 0 10px' }}>Tout ce dont vous avez besoin</h2>
            <p style={{ fontSize:16, color:'#64748B' }}>Conçu avec et pour les médecins esthétiques</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
            {FEATURES.map((f,i) => (
              <div key={i} style={{ background:'white', borderRadius:14, padding:24, border:'1px solid #E2E8F0', transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}>
                <div style={{ fontSize:28, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:6, color:'#0F172A' }}>{f.title}</div>
                <div style={{ fontSize:13.5, color:'#64748B', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding:'64px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px', margin:'0 0 10px' }}>Comment ça marche</h2>
            <p style={{ fontSize:16, color:'#64748B' }}>Du RDV Doctolib au suivi 1 an — automatiquement</p>
          </div>
          <div style={{ display:'flex', gap:0, position:'relative' }}>
            <div style={{ position:'absolute', top:28, left:'12.5%', right:'12.5%', height:2, background:'linear-gradient(90deg, #0596DE, #7C3AED)', zIndex:0 }} />
            {STEPS.map((s,i) => (
              <div key={i} style={{ flex:1, textAlign:'center', position:'relative', zIndex:1, padding:'0 12px' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg, #0596DE, #7C3AED)', color:'white', fontSize:15, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 4px 14px rgba(5,150,222,.35)' }}>{s.n}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:12.5, color:'#64748B', lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow builder preview */}
      <section style={{ background:'#0F172A', padding:'64px 24px', overflow:'hidden' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#0596DE', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Workflow Builder</div>
            <h2 style={{ fontSize:32, fontWeight:800, color:'white', letterSpacing:'-0.5px', margin:'0 0 16px', lineHeight:1.1 }}>Comme n8n, mais pour les médecins</h2>
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:24 }}>Glissez-déposez des nœuds pour créer vos automatisations : email, WhatsApp, PDF, signature, conditions, délais. Connectez vos apps favorites sans coder.</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Email', 'WhatsApp', 'Yousign', 'Webhook', 'Slack', 'Google Sheets', 'n8n', 'Zapier', 'Délai', 'Condition'].map(t => (
                <span key={t} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:99, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.12)' }}>{t}</span>
              ))}
            </div>
          </div>
          {/* Mini canvas mockup */}
          <div style={{ background:'#1E293B', borderRadius:16, padding:20, border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />)}
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginLeft:4 }}>Parcours Greffe FUE</span>
            </div>
            {[
              { icon:'⚡', label:'Consultation créée', color:'#D97706', bg:'rgba(217,119,6,0.15)' },
              { icon:'📄', label:'Générer consentement', color:'#475569', bg:'rgba(71,85,105,0.15)' },
              { icon:'✍️', label:'Envoyer pour signature', color:'#6B21A8', bg:'rgba(107,33,168,0.15)' },
              { icon:'⏰', label:'Attendre J-7', color:'#0596DE', bg:'rgba(5,150,222,0.15)' },
              { icon:'📧', label:'Email pré-opératoire', color:'#1D4ED8', bg:'rgba(29,78,216,0.15)' },
            ].map((n,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:n.bg, borderRadius:8, marginBottom:6, border:`1px solid ${n.color}30` }}>
                <span style={{ fontSize:14 }}>{n.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:n.color }}>{n.label}</span>
                {i < 4 && <div style={{ marginLeft:'auto', width:16, height:16, borderRadius:'50%', border:`2px solid ${n.color}`, display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:6, height:6, borderRadius:'50%', background:n.color }} /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding:'64px 24px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.5px', margin:'0 0 10px' }}>Tarifs transparents</h2>
            <p style={{ fontSize:16, color:'#64748B' }}>Sans engagement · Résiliez quand vous voulez</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {PRICING.map((plan,i) => (
              <div key={i} style={{ borderRadius:16, padding:28, border:`2px solid ${plan.highlight ? '#0596DE' : '#E2E8F0'}`, background: plan.highlight ? '#EFF6FF' : 'white', position:'relative' }}>
                {plan.highlight && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#0596DE', color:'white', fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:99, whiteSpace:'nowrap' }}>⭐ Le plus populaire</div>}
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
                <Link href="/auth/signup" style={{ display:'block', textAlign:'center', padding:'11px', borderRadius:9, border:'none', background: plan.highlight ? '#0596DE' : '#F8FAFC', color: plan.highlight ? 'white' : '#0F172A', fontSize:14, fontWeight:700, textDecoration:'none', cursor:'pointer' }}>
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
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.55)', marginBottom:28 }}>Rejoignez les praticiens qui gagnent 3h par jour sur leur administrative.</p>
        <Link href="/auth/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 32px', background:'#0596DE', color:'white', borderRadius:10, fontSize:15, fontWeight:700, textDecoration:'none', boxShadow:'0 8px 24px rgba(5,150,222,0.4)' }}>
          Commencer gratuitement →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ background:'#0F172A', borderTop:'1px solid rgba(255,255,255,0.07)', padding:'24px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', gap:24, marginBottom:12 }}>
          <Link href="/legal" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>Mentions légales</Link>
          <Link href="/legal#cgu" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>CGU</Link>
          <Link href="/legal#privacy" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>Confidentialité</Link>
          <Link href="/legal#dpa" style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>DPA</Link>
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', margin:0 }}>© {new Date().getFullYear()} ClinicFlow AI — Tous droits réservés</p>
      </footer>
    </div>
  )
}
