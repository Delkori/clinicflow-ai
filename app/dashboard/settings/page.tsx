'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const INTEGRATIONS = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '🤖',
    desc: 'Transcription audio (Whisper) et structuration IA (GPT-4o-mini) des consultations',
    color: '#10A37F',
    bg: '#F0FDF4',
    env_vars: ['OPENAI_API_KEY'],
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key', placeholder: 'sk-proj-...', type: 'password' },
    ],
    docs: 'https://platform.openai.com/api-keys',
    test_endpoint: '/api/ai/structure',
    test_body: { transcription: 'Test transcription', treatment: 'Injection HA' },
    test_label: 'Tester la transcription IA',
    setup: [
      'Créez un compte sur platform.openai.com',
      'Allez dans API Keys → Create new secret key',
      'Copiez la clé (commence par sk-proj-...)',
      'Ajoutez-la dans Vercel → Settings → Environment Variables',
    ],
  },
  {
    id: 'resend',
    label: 'Resend (emails transactionnels)',
    icon: '📧',
    desc: 'Envoi d\'emails automatiques aux patients. Recommandé pour les workflows.',
    color: '#0596DE',
    bg: '#EFF6FF',
    env_vars: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
    fields: [
      { key: 'RESEND_API_KEY', label: 'API Key', placeholder: 're_...', type: 'password' },
      { key: 'RESEND_FROM_EMAIL', label: 'Email expéditeur', placeholder: 'noreply@votre-domaine.fr', type: 'email' },
    ],
    docs: 'https://resend.com/api-keys',
    test_endpoint: null,
    test_label: 'Envoyer un email de test',
    setup: [
      'Créez un compte gratuit sur resend.com (3000 emails/mois offerts)',
      'Vérifiez votre domaine dans Resend → Domains',
      'Créez une clé API dans Resend → API Keys',
      'Ajoutez RESEND_API_KEY et RESEND_FROM_EMAIL dans Vercel',
    ],
    note: 'Sans configuration, les emails s\'envoient en mode démo (simulés mais non envoyés).',
  },
  {
    id: 'gmail_smtp',
    label: 'Gmail (SMTP direct)',
    icon: '📨',
    desc: 'Alternative à Resend — envoyez les emails directement depuis votre compte Gmail.',
    color: '#EA4335',
    bg: '#FEF0EF',
    env_vars: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    fields: [
      { key: 'GMAIL_USER', label: 'Adresse Gmail', placeholder: 'votre-clinique@gmail.com', type: 'email' },
      { key: 'GMAIL_APP_PASSWORD', label: 'Mot de passe application', placeholder: 'xxxx xxxx xxxx xxxx', type: 'password' },
    ],
    docs: 'https://support.google.com/accounts/answer/185833',
    test_label: 'Tester l\'envoi Gmail',
    setup: [
      'Dans votre compte Google → Sécurité → Validation en 2 étapes (activer)',
      'Puis Sécurité → Mots de passe des applications',
      'Créez un mot de passe pour "ClinicFlow" (16 caractères)',
      'Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD dans Vercel',
    ],
    note: 'Gmail limite à 500 emails/jour. Pour plus de volume, utilisez Resend.',
  },
  {
    id: 'twilio',
    label: 'Twilio — WhatsApp & SMS',
    icon: '💬',
    desc: 'Envoi de messages WhatsApp et SMS automatisés aux patients',
    color: '#F22F46',
    bg: '#FFF0F0',
    env_vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'],
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', placeholder: '••••••••••••••••••••••••••••••••', type: 'password' },
      { key: 'TWILIO_WHATSAPP_FROM', label: 'Numéro WhatsApp expéditeur', placeholder: 'whatsapp:+14155238886', type: 'text' },
    ],
    docs: 'https://console.twilio.com',
    test_label: 'Envoyer un WA de test',
    setup: [
      'Créez un compte sur twilio.com',
      'Dans la console → Account Info : copiez Account SID et Auth Token',
      'Pour WhatsApp : activez le Sandbox WhatsApp dans Messaging → Try it out',
      'Numéro sandbox par défaut : whatsapp:+14155238886',
    ],
    note: 'En mode sandbox, les patients doivent d\'abord envoyer "join [mot]" au numéro Twilio.',
  },
  {
    id: 'yousign',
    label: 'Yousign — Signature électronique',
    icon: '✍️',
    desc: 'Signature électronique conforme eIDAS. Consentements, devis, contrats.',
    color: '#6B21A8',
    bg: '#FAF5FF',
    env_vars: ['YOUSIGN_API_KEY', 'YOUSIGN_SANDBOX'],
    fields: [
      { key: 'YOUSIGN_API_KEY', label: 'API Key', placeholder: 'Votre clé Yousign', type: 'password' },
      { key: 'YOUSIGN_SANDBOX', label: 'Mode sandbox (test)', placeholder: 'true', type: 'text' },
    ],
    docs: 'https://developers.yousign.com',
    test_label: 'Tester la connexion Yousign',
    setup: [
      'Créez un compte sur yousign.com (essai gratuit disponible)',
      'Allez dans Organisation → API → Créer une clé API',
      'Pour les tests, mettez YOUSIGN_SANDBOX=true',
      'Pour la production, mettez YOUSIGN_SANDBOX=false',
    ],
    note: 'Environ 1€ par signature en production. Illimité en sandbox.',
    highlight: true,
  },
  {
    id: 'stripe',
    label: 'Stripe — Paiements',
    icon: '💳',
    desc: 'Gestion des abonnements et facturation automatique',
    color: '#635BFF',
    bg: '#F0EFFF',
    env_vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Clé secrète', placeholder: 'sk_live_...', type: 'password' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password' },
      { key: 'STRIPE_PRICE_STARTER', label: 'Price ID Starter', placeholder: 'price_...', type: 'text' },
      { key: 'STRIPE_PRICE_PRO', label: 'Price ID Pro', placeholder: 'price_...', type: 'text' },
      { key: 'STRIPE_PRICE_CLINIC', label: 'Price ID Clinic', placeholder: 'price_...', type: 'text' },
    ],
    docs: 'https://dashboard.stripe.com',
    setup: [
      'Créez un compte sur stripe.com',
      'Créez 3 produits avec les prix mensuel (49€, 99€, 199€)',
      'Copiez les Price IDs (price_xxxxx) pour chaque produit',
      'Configurez un webhook Stripe vers /api/stripe/webhook',
    ],
  },
]

const TABS = [
  { id: 'clinic',       label: 'Clinique',       icon: '🏥' },
  { id: 'treatments',   label: 'Traitements',    icon: '💊' },
  { id: 'doctolib',     label: 'Doctolib',       icon: '📅' },
  { id: 'integrations', label: 'Intégrations',   icon: '🔌' },
  { id: 'account',      label: 'Mon compte',     icon: '👤' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [tab, setTab]         = useState('clinic')
  const [clinic, setClinic]   = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [treatments, setTreatments] = useState<any[]>([])
  const [icalSources, setIcalSources] = useState<any[]>([])
  const [intakeForms, setIntakeForms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [showNewTreatment, setShowNewTreatment] = useState(false)
  const [integConfigs, setIntegConfigs] = useState<Record<string,Record<string,string>>>({})
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) return
      setProfile(prof)
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      if (cl) { setClinic(cl); setClinicName(cl.name) }
      const { data: trts } = await supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id).order('created_at')
      setTreatments(trts ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function saveClinic() {
    if (!clinic) return
    setSaving(true)
    await supabase.from('clinics').update({ name: clinicName }).eq('id', clinic.id)
    setClinic((c: any) => ({ ...c, name: clinicName }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function seedDefaults() {
    if (!clinic) return
    await supabase.rpc('seed_clinic_defaults', { p_clinic_id: clinic.id })
    const { data } = await supabase.from('treatments').select('*').eq('clinic_id', clinic.id)
    setTreatments(data ?? [])
  }

  async function deleteTreatment(id: string) {
    if (!confirm('Supprimer ce traitement ? Les workflows associés seront supprimés.')) return
    await supabase.from('treatments').delete().eq('id', id)
    setTreatments(ts => ts.filter(t => t.id !== id))
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* Left sidebar */}
      <aside style={{ width:220, borderRight:'1px solid var(--gray-200)', background:'white', flexShrink:0, padding:'24px 12px', display:'flex', flexDirection:'column', gap:2 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', letterSpacing:'0.07em', textTransform:'uppercase', padding:'0 10px 10px' }}>Paramètres</div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'9px 12px', borderRadius:8, border:'none', cursor:'pointer', textAlign:'left', width:'100%',
            background: tab === t.id ? 'var(--blue-light)' : 'transparent',
            color: tab === t.id ? 'var(--blue)' : 'var(--gray-600)',
            fontSize:13.5, fontWeight: tab === t.id ? 600 : 400,
            transition:'all .1s',
          }}>
            <span style={{ fontSize:15 }}>{t.icon}</span>
            <span>{t.label}</span>
            {tab === t.id && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'var(--blue)' }} />}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <div style={{ flex:1, overflow:'auto', padding:'32px', maxWidth:760 }}>

        {/* ── CLINIQUE ── */}
        {tab === 'clinic' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', margin:'0 0 4px' }}>Votre clinique</h2>
              <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>Informations générales et configuration de base</p>
            </div>

            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:16 }}>Informations générales</div>
              <div style={{ maxWidth:400, display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label className="label">Nom de la clinique</label>
                  <input className="input" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Clinique Esthétique Paris" />
                </div>
                <div>
                  <label className="label">Identifiant technique</label>
                  <div style={{ padding:'8px 12px', background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:8, fontSize:12, fontFamily:'monospace', color:'var(--gray-500)', userSelect:'all' }}>{clinic?.id}</div>
                </div>
                <button onClick={saveClinic} disabled={saving} className="btn-primary" style={{ width:'fit-content', gap:6 }}>
                  {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                </button>
              </div>
            </div>

            <div className="card" style={{ padding:24 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)' }}>Données de démarrage</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3 }}>Importez les traitements et workflows par défaut pour commencer rapidement</div>
                </div>
              </div>
              <div style={{ background:'var(--blue-light)', border:'1px solid var(--blue-mid)', borderRadius:10, padding:'14px 16px', marginBottom:14, display:'flex', gap:12 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
                <div style={{ fontSize:12.5, color:'var(--blue-dark)', lineHeight:1.6 }}>
                  Ceci créera : <strong>Greffe de cheveux</strong> (8 étapes automatisées), <strong>Laser visage</strong> (4 étapes), <strong>Acide hyaluronique</strong> — avec tous les workflows email + WhatsApp préconfigurés.
                </div>
              </div>
              <button onClick={seedDefaults} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                🚀 Importer les traitements & workflows par défaut
              </button>
            </div>
          </div>
        )}

        {/* ── TRAITEMENTS ── */}
        {tab === 'treatments' && (
          <div>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', margin:'0 0 4px' }}>Traitements</h2>
                <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>{treatments.length} traitement{treatments.length > 1 ? 's' : ''} configuré{treatments.length > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowNewTreatment(true)} className="btn-primary" style={{ fontSize:13 }}>+ Nouveau traitement</button>
            </div>

            {treatments.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>💊</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucun traitement configuré</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Ajoutez vos traitements pour créer des parcours patients automatisés</div>
                <button onClick={() => setShowNewTreatment(true)} className="btn-primary">+ Créer un traitement</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {treatments.map(t => (
                  <div key={t.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${t.color}18`, border:`1.5px solid ${t.color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background:t.color }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{t.name}</div>
                      {t.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{t.description}</div>}
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <Link href="/dashboard/workflows" style={{ fontSize:12, color:'var(--blue)', textDecoration:'none', padding:'5px 10px', borderRadius:6, border:'1px solid var(--blue-mid)', background:'var(--blue-light)' }}>
                        Workflows →
                      </Link>
                      <button onClick={() => deleteTreatment(t.id)} style={{ background:'none', border:'1px solid var(--gray-200)', borderRadius:6, cursor:'pointer', padding:'5px 8px', color:'var(--gray-400)', fontSize:12, transition:'all .1s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#FECACA'; e.currentTarget.style.color='#EF4444' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.color='var(--gray-400)' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DOCTOLIB iCAL ── */}
        {tab === 'doctolib' && (
          <DoctoLibSection clinicId={clinic?.id ?? ''} />
        )}

        {/* ── INTÉGRATIONS ── */}
        {tab === 'integrations' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', margin:'0 0 4px' }}>Intégrations</h2>
              <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>Connectez vos outils pour automatiser l'envoi d'emails, WhatsApp et signatures</p>
            </div>

            {/* Doctolib special card */}
            <div className="card" style={{ padding:20, marginBottom:16, borderLeft:`4px solid #0596DE` }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📅</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Doctolib</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>Import de patients et synchronisation des rendez-vous</div>
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <span style={{ fontSize:11, background:'#F0FDF4', color:'#059669', border:'1px solid #BBF7D0', padding:'3px 10px', borderRadius:99, fontWeight:600 }}>✓ Import CSV disponible</span>
                  <Link href="/dashboard/import" className="btn-primary" style={{ textDecoration:'none', fontSize:12, padding:'6px 14px' }}>Importer →</Link>
                </div>
              </div>
              <div style={{ marginTop:14, padding:'12px 14px', background:'#FFFBEB', borderRadius:8, fontSize:12, color:'#92400E', display:'flex', gap:8 }}>
                <span>ℹ️</span>
                <span><strong>Pas d'API publique Doctolib.</strong> L'intégration se fait via export CSV depuis Doctolib Pro → Paramètres → Exports de données. La synchronisation temps-réel nécessite le programme partenaire Doctolib (sur demande).</span>
              </div>
            </div>

            {INTEGRATIONS.map(integ => (
              <IntegCard key={integ.id} integ={integ} />
            ))}
          </div>
        )}

        {/* ── MON COMPTE ── */}
        {tab === 'account' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', margin:'0 0 4px' }}>Mon compte</h2>
              <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>Informations de votre profil médecin</p>
            </div>
            <div className="card" style={{ padding:24, maxWidth:440 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--gray-100)' }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'white', flexShrink:0 }}>
                  {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--gray-900)' }}>{profile?.full_name}</div>
                  <div style={{ fontSize:13, color:'var(--gray-500)', marginTop:2, textTransform:'capitalize' }}>{profile?.role} · {clinic?.name}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Nom complet',   value: profile?.full_name },
                  { label:'Email',         value: profile?.email },
                  { label:'Rôle',          value: profile?.role, capitalize: true },
                  { label:'Clinique',      value: clinic?.name },
                ].map(f => (
                  <div key={f.label}>
                    <label className="label">{f.label}</label>
                    <div style={{ padding:'9px 12px', background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:8, fontSize:14, color:'var(--gray-700)', textTransform: f.capitalize ? 'capitalize' : 'none' }}>
                      {f.value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showNewTreatment && (
        <NewTreatmentModal
          clinicId={clinic?.id ?? ''}
          onClose={() => setShowNewTreatment(false)}
          onCreated={(t: any) => { setTreatments(ts => [...ts, t]); setShowNewTreatment(false) }}
        />
      )}
    </div>
  )
}

function IntegCard({ integ }: { integ: (typeof INTEGRATIONS)[0] }) {
  const [expanded, setExpanded] = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState<{ok:boolean;msg:string}|null>(null)

  // Check if env vars are likely set (we can't read them client-side, but we show setup guide)
  const isConfigured = (integ as any).highlight === true // Yousign highlight = needs attention

  async function runTest() {
    setTesting(true)
    setTestResult(null)
    try {
      if (integ.id === 'resend') {
        // Test by sending to self via the email API
        const res = await fetch('/api/email/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: 'test', subject: 'Test ClinicFlow', body: 'Test d\'envoi email depuis ClinicFlow AI.' }),
        })
        const d = await res.json()
        setTestResult(d.simulated
          ? { ok: false, msg: 'Mode démo — clé Resend non configurée. Ajoutez RESEND_API_KEY dans Vercel.' }
          : { ok: true, msg: '✓ Email envoyé avec succès !' })
      } else if (integ.id === 'openai') {
        const res = await fetch('/api/ai/structure', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcription: 'Bonjour, test de connexion OpenAI', treatment: 'Test' }),
        })
        const d = await res.json()
        setTestResult(d.structured
          ? { ok: true, msg: '✓ OpenAI connecté — IA fonctionnelle' }
          : { ok: false, msg: 'Clé OpenAI non configurée ou invalide. Ajoutez OPENAI_API_KEY dans Vercel.' })
      } else if (integ.id === 'yousign') {
        setTestResult({ ok: false, msg: 'Testez depuis Documents → Envoyer pour signature (mode démo disponible sans clé).' })
      } else if (integ.id === 'twilio') {
        setTestResult({ ok: false, msg: 'Testez en envoyant un WhatsApp depuis la fiche d\'un patient qui a un numéro.' })
      } else {
        setTestResult({ ok: false, msg: 'Test non disponible pour cette intégration. Suivez les instructions de configuration.' })
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: `Erreur : ${err.message}` })
    }
    setTesting(false)
  }

  return (
    <div className="card" style={{ marginBottom:10, overflow:'hidden', borderLeft: (integ as any).highlight ? `4px solid ${integ.color}` : 'none' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}
        onClick={() => { setExpanded(!expanded); setTestResult(null) }}>
        <div style={{ width:40, height:40, borderRadius:10, background:(integ as any).bg ?? `${integ.color}15`, border:`1.5px solid ${integ.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
          {integ.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{integ.label}</span>
            {(integ as any).highlight && <span style={{ fontSize:10, background:`${integ.color}15`, color:integ.color, border:`1px solid ${integ.color}30`, padding:'1px 7px', borderRadius:99, fontWeight:600 }}>Recommandé</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{integ.desc}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
          <a href={(integ as any).docs} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize:11, color:'var(--blue)', textDecoration:'none' }}>Docs ↗</a>
          <span style={{ fontSize:12, color:'var(--gray-400)', display:'inline-block', transition:'transform .15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'0 20px 20px', borderTop:'1px solid var(--gray-100)' }}>
          <div style={{ paddingTop:16, display:'flex', flexDirection:'column', gap:16 }}>

            {/* Setup instructions */}
            {(integ as any).setup && (
              <div style={{ background:'var(--blue-light)', border:'1px solid var(--blue-mid)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--blue-dark)', marginBottom:10 }}>📋 Comment configurer</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {(integ as any).setup.map((step: string, i: number) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--blue)', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</div>
                      <span style={{ fontSize:12, color:'var(--blue-dark)', lineHeight:1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {(integ as any).note && (
              <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#92400E', display:'flex', gap:6 }}>
                <span>ℹ️</span><span>{(integ as any).note}</span>
              </div>
            )}

            {/* Env vars needed */}
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Variables d'environnement à configurer dans Vercel</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(integ as any).fields.map((f: any) => (
                  <div key={f.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--gray-50)', borderRadius:8, border:'1px solid var(--gray-200)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-600)' }}>{f.label}</div>
                      <code style={{ fontSize:10, color:integ.color, background:`${integ.color}10`, padding:'1px 6px', borderRadius:3 }}>{f.key}</code>
                    </div>
                    <div style={{ fontSize:11, color:'var(--gray-400)', fontStyle:'italic' }}>{f.placeholder}</div>
                  </div>
                ))}
              </div>
              <a href="https://vercel.com" target="_blank"
                style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:10, fontSize:12, color:'var(--blue)', textDecoration:'none', fontWeight:600 }}>
                Ouvrir Vercel → Settings → Environment Variables ↗
              </a>
            </div>

            {/* Test button */}
            {(integ as any).test_label && (
              <div>
                <button onClick={runTest} disabled={testing}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:8, border:`1px solid ${integ.color}40`, background:`${integ.color}10`, color:integ.color, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  {testing ? <><div style={{ width:14, height:14, border:`2px solid ${integ.color}40`, borderTopColor:integ.color, borderRadius:'50%', animation:'spin .7s linear infinite' }} />Test en cours...</> : `🧪 ${(integ as any).test_label}`}
                  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                </button>
                {testResult && (
                  <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background: testResult.ok ? '#F0FDF4' : '#FFF8E6', border:`1px solid ${testResult.ok ? '#BBF7D0' : '#FDE68A'}`, fontSize:12, color: testResult.ok ? '#166534' : '#92400E' }}>
                    {testResult.msg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewTreatmentModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name:'', description:'', color:'#0596DE' })
  const [loading, setLoading] = useState(false)
  const COLORS = ['#0596DE','#7C3AED','#059669','#D97706','#DC2626','#DB2777','#2563EB','#0F172A']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase.from('treatments').insert({ ...form, clinic_id: clinicId }).select().single()
    setLoading(false)
    if (data) onCreated(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau traitement</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)', lineHeight:1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label className="label">Nom du traitement *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Greffe de cheveux, Laser CO2..." />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ resize:'none' }} placeholder="Description courte..." />
            </div>
            <div>
              <label className="label">Couleur d'identification</label>
              <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width:28, height:28, borderRadius:'50%', background:c, border: form.color === c ? '3px solid var(--gray-900)' : '2px solid transparent', cursor:'pointer', transform: form.color === c ? 'scale(1.2)' : 'scale(1)', transition:'all .1s', outline: form.color === c ? `3px solid ${c}40` : 'none' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Création...' : 'Créer le traitement'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Doctolib iCal Section ─────────────────────────────────────────────────
function DoctoLibSection({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [sources, setSources] = useState<any[]>([])
  const [newUrl, setNewUrl]   = useState('')
  const [newName, setNewName] = useState('Doctolib')
  const [syncing, setSyncing] = useState<string|null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [adding, setAdding]   = useState(false)
  const [toast, setToast]     = useState<any>(null)

  useEffect(() => {
    supabase.from('ical_sources').select('*').eq('clinic_id', clinicId).then(({ data }) => setSources(data ?? []))
  }, [clinicId])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function testUrl() {
    if (!newUrl) return
    setTesting(true); setTestResult(null)
    const res = await fetch(`/api/ical/sync?url=${encodeURIComponent(newUrl)}`)
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  async function addSource() {
    if (!newUrl || !clinicId) return
    setAdding(true)
    const { data } = await supabase.from('ical_sources').insert({ clinic_id: clinicId, name: newName, url: newUrl }).select().single()
    if (data) { setSources(prev => [...prev, data]); setNewUrl(''); setTestResult(null) }
    setAdding(false)
    showToast('Flux iCal ajouté ✓')
  }

  async function syncSource(source: any) {
    setSyncing(source.id)
    const res = await fetch('/api/ical/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: source.id, clinic_id: clinicId }),
    })
    const data = await res.json()
    setSyncing(null)
    if (data.success) {
      showToast(`✓ ${data.created} RDV créés · ${data.patient_created} nouveaux patients`)
      setSources(prev => prev.map(s => s.id === source.id ? { ...s, last_synced_at: new Date().toISOString(), sync_count: (s.sync_count||0) + data.created } : s))
    } else {
      showToast(`Erreur : ${data.error}`, false)
    }
  }

  async function deleteSource(id: string) {
    await supabase.from('ical_sources').delete().eq('id', id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500, boxShadow:'0 8px 24px rgba(0,0,0,.25)' }}>
          {toast.msg}
        </div>
      )}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', margin:'0 0 4px' }}>Synchronisation Doctolib</h2>
        <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>Importez vos RDV Doctolib et créez automatiquement les fiches patients</p>
      </div>

      {/* Explainer */}
      <div className="card" style={{ padding:20, marginBottom:16, borderLeft:'4px solid var(--blue)' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:10 }}>Comment récupérer votre flux iCal Doctolib</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {[
            'Connectez-vous à Doctolib Pro',
            'Allez dans Agenda → Paramètres → Synchronisation calendrier',
            'Copiez l\'URL du flux iCal généré',
            'Collez-la ci-dessous',
          ].map((step, i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--blue)', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</div>
              <span style={{ fontSize:13, color:'var(--gray-600)' }}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, padding:'10px 12px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E', display:'flex', gap:8 }}>
          <span>ℹ️</span>
          <span>Le flux iCal est disponible aussi depuis Google Calendar, Outlook, ou tout autre agenda. Format : <code>webcal://...</code> ou <code>https://...</code></span>
        </div>
      </div>

      {/* Add source form */}
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:14 }}>Ajouter un flux iCal</div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">Nom du calendrier</label>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Doctolib, Google Calendar..." />
          </div>
          <div>
            <label className="label">URL du flux iCal *</label>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" value={newUrl} onChange={e => { setNewUrl(e.target.value); setTestResult(null) }} placeholder="https://www.doctolib.fr/ics/..." style={{ flex:1 }} />
              <button onClick={testUrl} disabled={!newUrl || testing}
                style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-700)', flexShrink:0, whiteSpace:'nowrap' }}>
                {testing ? '...' : '🧪 Tester'}
              </button>
            </div>
          </div>
          {testResult && (
            <div style={{ padding:'10px 12px', background: testResult.valid ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${testResult.valid ? '#BBF7D0' : '#FECACA'}`, borderRadius:8, fontSize:12, color: testResult.valid ? '#059669' : '#DC2626' }}>
              {testResult.valid
                ? `✅ Flux valide — ${testResult.event_count} événement${testResult.event_count > 1 ? 's' : ''} détecté${testResult.event_count > 1 ? 's' : ''}`
                : `❌ Flux invalide : ${testResult.error}`}
            </div>
          )}
          <button onClick={addSource} disabled={adding || !newUrl || (testResult && !testResult.valid)} className="btn-primary" style={{ width:'fit-content', fontSize:13 }}>
            {adding ? 'Ajout...' : '+ Ajouter ce flux'}
          </button>
        </div>
      </div>

      {/* Sources list */}
      {sources.length > 0 && (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:10 }}>Flux configurés ({sources.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sources.map(s => (
              <div key={s.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:36, height:36, borderRadius:9, background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📅</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'var(--gray-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>{s.url}</div>
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2, display:'flex', gap:10 }}>
                    {s.last_synced_at && <span>Dernière sync : {new Date(s.last_synced_at).toLocaleString('fr-FR')}</span>}
                    {s.sync_count > 0 && <span>· {s.sync_count} événements importés</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => syncSource(s)} disabled={syncing === s.id}
                    style={{ fontSize:12, padding:'7px 14px', borderRadius:7, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontWeight:600, display:'flex', gap:6, alignItems:'center' }}>
                    {syncing === s.id ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Sync...</> : '🔄 Synchroniser'}
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </button>
                  <button onClick={() => deleteSource(s.id)} style={{ fontSize:12, padding:'7px 8px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#FECACA'; e.currentTarget.style.color='#EF4444' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.color='var(--gray-400)' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
