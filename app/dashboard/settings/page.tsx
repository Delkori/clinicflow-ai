'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [clinic, setClinic] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [treatments, setTreatments] = useState<any[]>([])
  const [tab, setTab] = useState<'clinic' | 'treatments' | 'account' | 'integrations'>('clinic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [showNewTreatment, setShowNewTreatment] = useState(false)
  const supabase = createClient()

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
  }

  async function seedDefaults() {
    if (!clinic) return
    await supabase.rpc('seed_clinic_defaults', { p_clinic_id: clinic.id })
    const { data } = await supabase.from('treatments').select('*').eq('clinic_id', clinic.id)
    setTreatments(data ?? [])
    alert('Traitements et workflows par défaut ajoutés !')
  }

  async function deleteTreatment(id: string) {
    if (!confirm('Supprimer ce traitement ?')) return
    await supabase.from('treatments').delete().eq('id', id)
    setTreatments(ts => ts.filter(t => t.id !== id))
  }

  const TABS = [
    { id: 'clinic', label: 'Clinique', icon: '🏥' },
    { id: 'treatments', label: 'Traitements', icon: '💊' },
    { id: 'integrations', label: 'Intégrations', icon: '🔌' },
    { id: 'account', label: 'Mon compte', icon: '👤' },
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><div style={{ width: '28px', height: '28px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Paramètres</div>
        <div className="page-subtitle">Configuration de votre espace clinique</div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Sidebar tabs */}
          <div style={{ width: '200px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px', border: 'none',
                  background: tab === t.id ? 'var(--blue-light)' : 'transparent',
                  color: tab === t.id ? 'var(--blue)' : 'var(--gray-600)',
                  fontSize: '13.5px', fontWeight: tab === t.id ? '600' : '400',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {tab === 'clinic' && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px', color: 'var(--gray-900)' }}>Informations de la clinique</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                  <div>
                    <label className="label">Nom de la clinique</label>
                    <input className="input" value={clinicName} onChange={e => setClinicName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Identifiant clinique</label>
                    <div style={{ padding: '8px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--gray-500)' }}>{clinic?.id}</div>
                  </div>
                  <button onClick={saveClinic} disabled={saving} className="btn-primary" style={{ width: 'fit-content' }}>
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: '28px', paddingTop: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: 'var(--gray-900)' }}>Données de démarrage</div>
                  <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '14px' }}>Importez les traitements et workflows Doctolib par défaut : Greffe de cheveux (8 étapes), Laser visage (4 étapes), Acide hyaluronique.</div>
                  <button onClick={seedDefaults} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🚀 Importer les traitements & workflows par défaut
                  </button>
                </div>
              </div>
            )}

            {tab === 'treatments' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{treatments.length} traitement{treatments.length > 1 ? 's' : ''} configuré{treatments.length > 1 ? 's' : ''}</div>
                  <button onClick={() => setShowNewTreatment(true)} className="btn-primary" style={{ fontSize: '13px' }}>+ Nouveau traitement</button>
                </div>
                {treatments.length === 0 ? (
                  <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>💊</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Aucun traitement</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {treatments.map(t => (
                      <div key={t.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--gray-900)' }}>{t.name}</div>
                          {t.description && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{t.description}</div>}
                        </div>
                        <button onClick={() => deleteTreatment(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: '14px' }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'integrations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { name: 'Doctolib', icon: '📅', desc: 'Import de patients et rendez-vous', status: 'Import CSV disponible', badge: 'badge-green', href: '/dashboard/import' },
                  { name: 'OpenAI Whisper', icon: '🎙️', desc: 'Transcription audio des consultations', status: 'Clé API requise', badge: 'badge-gray' },
                  { name: 'Resend', icon: '📧', desc: 'Envoi d\'emails automatiques', status: 'Clé API requise', badge: 'badge-gray' },
                  { name: 'Twilio WhatsApp', icon: '💬', desc: 'Messages WhatsApp automatisés', status: 'Clé API requise', badge: 'badge-gray' },
                  { name: 'DocuSign', icon: '✍️', desc: 'Signature électronique des documents', status: 'Bientôt disponible', badge: 'badge-orange' },
                ].map(int => (
                  <div key={int.name} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{int.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>{int.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{int.desc}</div>
                    </div>
                    <span className={`badge ${int.badge}`}>{int.status}</span>
                    {int.href && <a href={int.href} className="btn-primary" style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 12px' }}>Utiliser →</a>}
                  </div>
                ))}
              </div>
            )}

            {tab === 'account' && (
              <div className="card" style={{ padding: '24px', maxWidth: '400px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Mon compte</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Nom complet', value: profile?.full_name },
                    { label: 'Email', value: profile?.email },
                    { label: 'Rôle', value: profile?.role },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <div style={{ padding: '8px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px', color: 'var(--gray-700)', textTransform: f.label === 'Rôle' ? 'capitalize' : 'none' }}>
                        {f.value || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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

function NewTreatmentModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', description: '', color: '#0596DE' })
  const [loading, setLoading] = useState(false)
  const COLORS = ['#0596DE', '#7C3AED', '#059669', '#D97706', '#DC2626', '#DB2777', '#2563EB', '#0F172A']
  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('treatments').insert({ ...form, clinic_id: clinicId }).select().single()
    setLoading(false)
    if (data) onCreated(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau traitement</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label className="label">Nom *</label><input className="input" value={form.name} onChange={update('name')} required placeholder="Greffe de cheveux..." /></div>
            <div><label className="label">Description</label><textarea className="input" value={form.description} onChange={update('description')} rows={2} style={{ resize: 'none' }} /></div>
            <div>
              <label className="label">Couleur</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid var(--gray-900)' : '2px solid transparent', cursor: 'pointer', transform: form.color === c ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.1s' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Création...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
