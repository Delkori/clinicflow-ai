'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const INTEGRATIONS = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '🤖',
    desc: 'Transcription audio (Whisper) et structuration IA (GPT-4) des consultations',
    color: '#10A37F',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-proj-...', type: 'password' },
      { key: 'model',   label: 'Modèle',  placeholder: 'gpt-4o-mini',  type: 'text'     },
    ],
    docs: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'resend',
    label: 'Resend — Emails',
    icon: '📧',
    desc: 'Envoi automatique des emails aux patients selon le workflow',
    color: '#0596DE',
    fields: [
      { key: 'api_key',    label: 'API Key',           placeholder: 're_...', type: 'password' },
      { key: 'from_email', label: 'Email expéditeur', placeholder: 'clinique@votre-domaine.fr', type: 'email' },
    ],
    docs: 'https://resend.com/api-keys',
  },
  {
    id: 'twilio',
    label: 'Twilio — WhatsApp',
    icon: '💬',
    desc: 'Envoi de messages WhatsApp automatisés (suivi post-op, rappels)',
    color: '#25D366',
    fields: [
      { key: 'account_sid',   label: 'Account SID',    placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text'     },
      { key: 'auth_token',    label: 'Auth Token',     placeholder: '••••••••••••••••••••••••••••••••',  type: 'password' },
      { key: 'from_number',   label: 'Numéro WhatsApp',placeholder: 'whatsapp:+14155238886',             type: 'text'     },
    ],
    docs: 'https://console.twilio.com',
  },
  {
    id: 'docusign',
    label: 'DocuSign — Signatures',
    icon: '✍️',
    desc: 'Envoi et signature électronique des consentements éclairés',
    color: '#7C3AED',
    fields: [
      { key: 'integration_key', label: 'Integration Key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text'     },
      { key: 'account_id',      label: 'Account ID',      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text'     },
      { key: 'access_token',    label: 'Access Token',    placeholder: '••••••••••••••••',                     type: 'password' },
    ],
    docs: 'https://developers.docusign.com',
    badge: 'Bientôt',
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

function IntegCard({ integ }: { integ: typeof INTEGRATIONS[0] }) {
  const [expanded, setExpanded] = useState(false)
  const [vals, setVals] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const configured = Object.values(vals).some(v => v && !v.includes('•'))

  function save() {
    setSaving(true)
    // In a real app, save to Supabase vault / env
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }, 600)
  }

  return (
    <div className="card" style={{ marginBottom:10, overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ width:40, height:40, borderRadius:10, background:`${integ.color}15`, border:`1.5px solid ${integ.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
          {integ.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{integ.label}</span>
            {integ.badge && <span style={{ fontSize:10, background:'#FFFBEB', color:'#D97706', border:'1px solid #FDE68A', padding:'1px 7px', borderRadius:99, fontWeight:600 }}>{integ.badge}</span>}
            {configured && <span style={{ fontSize:10, background:'#F0FDF4', color:'#059669', border:'1px solid #BBF7D0', padding:'1px 7px', borderRadius:99, fontWeight:600 }}>✓ Configuré</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{integ.desc}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
          <a href={integ.docs} target="_blank" style={{ fontSize:11, color:'var(--blue)', textDecoration:'none' }}>Docs ↗</a>
          <span style={{ fontSize:12, color:'var(--gray-400)', transition:'transform .15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display:'inline-block' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'0 20px 20px', borderTop:'1px solid var(--gray-100)' }}>
          <div style={{ paddingTop:16, display:'flex', flexDirection:'column', gap:12 }}>
            {integ.fields.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input className="input" type={f.type} value={vals[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize:13, width:'fit-content' }}>
                {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Enregistrer la configuration'}
              </button>
              <span style={{ fontSize:11, color:'var(--gray-400)' }}>Les clés sont stockées de façon sécurisée</span>
            </div>
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
