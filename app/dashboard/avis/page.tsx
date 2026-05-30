'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const PLATFORMS = {
  google:      { label: 'Google',      icon: '🔍', color: '#4285F4', bg: '#EFF6FF' },
  trustpilot:  { label: 'Trustpilot',  icon: '⭐', color: '#00B67A', bg: '#ECFDF5' },
  doctolib:    { label: 'Doctolib',    icon: '📅', color: '#0596DE', bg: '#EFF6FF' },
  autre:       { label: 'Autre',       icon: '📋', color: '#6B7280', bg: '#F3F4F6' },
}

const STATUS_CFG = {
  pending:   { label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  sent:      { label: 'Envoyé',     color: '#0891B2', bg: '#ECFEFF' },
  clicked:   { label: 'Consulté',   color: '#7C3AED', bg: '#F5F3FF' },
  reviewed:  { label: '✓ Avis déposé', color: '#059669', bg: '#ECFDF5' },
}

export default function AvisPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [clinicId, setClinicId] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [toast, setToast] = useState<any>(null)
  const [sending, setSending] = useState<string|null>(null)
  const [tab, setTab] = useState<'requests'|'stats'>('requests')
  const [form, setForm] = useState({
    patient_id: '',
    platform: 'google',
    review_url: '',
    channel: 'whatsapp',
  })
  const [searchPat, setSearchPat] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id, clinic:clinics(name)').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    setClinicName((prof as any).clinic?.name ?? 'Ma Clinique')
    const [{ data: reqs }, { data: pts }] = await Promise.all([
      supabase.from('review_requests').select('*, patient:patients(first_name,last_name,phone,email)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }),
      supabase.from('patients').select('id, first_name, last_name, phone, email').order('last_name'),
    ])
    setRequests(reqs ?? [])
    setPatients(pts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createAndSend() {
    if (!form.patient_id || !clinicId) return
    setSending('new')
    const patient = patients.find(p => p.id === form.patient_id)
    if (!patient) { setSending(null); return }

    // Create request
    const { data: req } = await supabase.from('review_requests').insert({
      clinic_id: clinicId,
      patient_id: form.patient_id,
      platform: form.platform,
      review_url: form.review_url || googleUrl || null,
      channel: form.channel,
      status: 'pending',
    }).select().single()

    if (!req) { setSending(null); showToast('Erreur création', false); return }

    const plat = PLATFORMS[form.platform as keyof typeof PLATFORMS]
    const reviewLink = form.review_url || googleUrl || '#'

    if (form.channel === 'whatsapp' && patient.phone) {
      const msg = `Bonjour ${patient.first_name} ! 😊\n\nNous espérons que vous êtes satisfait(e) de votre soin chez ${clinicName}.\n\nVotre avis nous est précieux et aide d'autres patients à nous trouver. Ça prend 30 secondes :\n${reviewLink}\n\nMerci infiniment ! 🙏`
      window.open(`https://wa.me/${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    } else if (form.channel === 'email' && patient.email) {
      await fetch('/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: form.patient_id,
          subject: `Votre avis compte pour nous — ${clinicName}`,
          body: `Bonjour {{first_name}},\n\nNous espérons que vous êtes satisfait(e) de votre soin chez ${clinicName}.\n\nVotre avis sur ${plat.label} nous aide énormément :\n${reviewLink}\n\nMerci de votre confiance !\n${clinicName}`,
        }),
      })
    }

    await supabase.from('review_requests').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', req.id)
    setSending(null)
    showToast(`✓ Demande envoyée par ${form.channel === 'whatsapp' ? 'WhatsApp' : 'email'}`)
    setShowNew(false)
    setForm({ patient_id:'', platform:'google', review_url:'', channel:'whatsapp' })
    load()
  }

  async function markReviewed(id: string) {
    await supabase.from('review_requests').update({ status: 'reviewed' }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'reviewed' } : r))
    showToast('✓ Marqué comme avis déposé')
  }

  // Stats
  const total = requests.length
  const sent = requests.filter(r => r.status !== 'pending').length
  const reviewed = requests.filter(r => r.status === 'reviewed').length
  const conversionRate = sent > 0 ? Math.round((reviewed / sent) * 100) : 0

  const filteredPats = patients.filter(p => !searchPat || `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchPat.toLowerCase()))

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Avis & Réputation</div>
          <div className="page-subtitle">{reviewed} avis collectés · {conversionRate}% de taux de conversion · {sent} demandes envoyées</div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Demander un avis</button>
      </div>

      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 28px' }}>
        {([['requests','📋 Demandes'],['stats','📊 Statistiques']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Demandes totales', value: total, icon:'📤', color:'var(--gray-700)' },
            { label:'Envoyées', value: sent, icon:'✉️', color:'#0891B2' },
            { label:'Avis déposés', value: reviewed, icon:'⭐', color:'#D97706' },
            { label:'Taux conversion', value: `${conversionRate}%`, icon:'📈', color:'#059669' },
          ].map(k => (
            <div key={k.label} className="stat-card" style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{k.icon}</div>
              <div>
                <div className="stat-value" style={{ fontSize:22, color:k.color }}>{k.value}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Google URL reminder */}
        {!googleUrl && (
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'14px 18px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' }}>
            <span style={{ fontSize:20, flexShrink:0 }}>🔍</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1D4ED8', marginBottom:4 }}>Configurez votre lien Google Avis</div>
              <div style={{ fontSize:12, color:'#3B82F6', marginBottom:8 }}>Allez sur Google My Business → Obtenir plus d'avis → Copiez le lien court</div>
              <input className="input" value={googleUrl} onChange={e => setGoogleUrl(e.target.value)} placeholder="https://g.page/r/votre-clinique/review" style={{ fontSize:12 }} />
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          requests.length === 0 ? (
            <div className="card" style={{ padding:48, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⭐</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucune demande d'avis encore</div>
              <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:20 }}>Après chaque consultation réussie, demandez un avis à votre patient</div>
              <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>Envoyer ma première demande</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Plateforme</th><th>Canal</th><th>Statut</th><th>Envoyé le</th><th></th></tr></thead>
                <tbody>
                  {requests.map(r => {
                    const plat = PLATFORMS[r.platform as keyof typeof PLATFORMS] ?? PLATFORMS.autre
                    const sc = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight:500, fontSize:13 }}>{r.patient?.first_name} {r.patient?.last_name}</div>
                          {r.patient?.phone && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{r.patient.phone}</div>}
                        </td>
                        <td>
                          <span style={{ fontSize:12, fontWeight:600, color:plat.color, background:plat.bg, padding:'2px 8px', borderRadius:99 }}>{plat.icon} {plat.label}</span>
                        </td>
                        <td style={{ fontSize:12, color:'var(--gray-600)' }}>{r.channel === 'whatsapp' ? '💬 WhatsApp' : '📧 Email'}</td>
                        <td>
                          <span style={{ fontSize:11, fontWeight:700, color:sc.color, background:sc.bg, padding:'3px 9px', borderRadius:99 }}>{sc.label}</span>
                        </td>
                        <td style={{ fontSize:11, color:'var(--gray-500)' }}>{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                        <td>
                          <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                            {r.review_url && (
                              <a href={r.review_url} target="_blank" style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', color:'var(--blue)', textDecoration:'none' }}>🔗</a>
                            )}
                            {r.patient?.phone && r.status !== 'reviewed' && (
                              <a href={`https://wa.me/${r.patient.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Bonjour ${r.patient.first_name}, avez-vous eu un moment pour laisser votre avis ? ${r.review_url || ''}`)}`}
                                target="_blank"
                                style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid #BBF7D0', background:'#ECFDF5', color:'#059669', textDecoration:'none', fontWeight:600 }}>
                                💬 Relancer
                              </a>
                            )}
                            {r.status !== 'reviewed' && (
                              <button onClick={() => markReviewed(r.id)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'none', background:'#FFFBEB', color:'#D97706', cursor:'pointer', fontWeight:600 }}>
                                ✓ Avis reçu
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:16 }}>Par plateforme</div>
              {Object.entries(PLATFORMS).map(([key, plat]) => {
                const count = requests.filter(r => r.platform === key).length
                const reviewed_count = requests.filter(r => r.platform === key && r.status === 'reviewed').length
                if (count === 0) return null
                return (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <span style={{ fontSize:16, width:24 }}>{plat.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)' }}>{plat.label}</span>
                        <span style={{ fontSize:12, color:'var(--gray-500)' }}>{reviewed_count}/{count}</span>
                      </div>
                      <div style={{ height:5, background:'var(--gray-100)', borderRadius:99 }}>
                        <div style={{ height:'100%', width:`${count > 0 ? Math.round(reviewed_count/count*100) : 0}%`, background:plat.color, borderRadius:99 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:16 }}>Par canal</div>
              {['whatsapp','email'].map(channel => {
                const count = requests.filter(r => r.channel === channel).length
                const reviewed_count = requests.filter(r => r.channel === channel && r.status === 'reviewed').length
                return (
                  <div key={channel} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <span style={{ fontSize:16, width:24 }}>{channel === 'whatsapp' ? '💬' : '📧'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)' }}>{channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
                        <span style={{ fontSize:12, color:'var(--gray-500)' }}>{count} envoyés · {reviewed_count} avis</span>
                      </div>
                      <div style={{ height:5, background:'var(--gray-100)', borderRadius:99 }}>
                        <div style={{ height:'100%', width:`${count > 0 ? Math.round(reviewed_count/count*100) : 0}%`, background: channel==='whatsapp' ? '#25D366' : 'var(--blue)', borderRadius:99 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal nouvelle demande */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title">⭐ Demander un avis</div>
              <button onClick={() => setShowNew(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Patient */}
              <div>
                <label className="label">Patient *</label>
                {form.patient_id ? (
                  <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'var(--blue-light)', borderRadius:9, border:'1px solid var(--blue-mid)' }}>
                    <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{patients.find(p => p.id === form.patient_id)?.first_name} {patients.find(p => p.id === form.patient_id)?.last_name}</span>
                    <button onClick={() => setForm(f => ({ ...f, patient_id: '' }))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:16 }}>×</button>
                  </div>
                ) : (
                  <>
                    <input className="input" value={searchPat} onChange={e => setSearchPat(e.target.value)} placeholder="Rechercher..." style={{ marginBottom:6 }} />
                    <div style={{ maxHeight:150, overflowY:'auto', border:'1px solid var(--gray-200)', borderRadius:8, overflow:'hidden' }}>
                      {filteredPats.slice(0,6).map(p => (
                        <div key={p.id} onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setSearchPat('') }}
                          style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--gray-50)', fontSize:13 }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--gray-50)'}
                          onMouseLeave={e => e.currentTarget.style.background='white'}>
                          {p.first_name} {p.last_name} {p.phone && <span style={{ color:'var(--gray-400)', fontSize:11 }}>· {p.phone}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Plateforme */}
              <div>
                <label className="label">Plateforme</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
                  {Object.entries(PLATFORMS).map(([key, plat]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, platform: key }))}
                      style={{ padding:'8px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${form.platform===key ? plat.color : 'var(--gray-200)'}`, background: form.platform===key ? plat.bg : 'white', textAlign:'center' }}>
                      <div style={{ fontSize:18 }}>{plat.icon}</div>
                      <div style={{ fontSize:11, fontWeight:600, color: form.platform===key ? plat.color : 'var(--gray-500)', marginTop:3 }}>{plat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="label">Lien vers la page d'avis</label>
                <input className="input" value={form.review_url || googleUrl} onChange={e => { setForm(f => ({ ...f, review_url: e.target.value })); setGoogleUrl(e.target.value) }} placeholder="https://g.page/r/votre-clinique/review" />
              </div>

              {/* Canal */}
              <div>
                <label className="label">Canal d'envoi</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['whatsapp','email'] as const).map(ch => (
                    <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                      style={{ flex:1, padding:'9px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${form.channel===ch ? (ch==='whatsapp'?'#25D366':'var(--blue)') : 'var(--gray-200)'}`, background: form.channel===ch ? (ch==='whatsapp'?'#ECFDF5':'var(--blue-light)') : 'white', color: form.channel===ch ? (ch==='whatsapp'?'#059669':'var(--blue)') : 'var(--gray-600)', fontSize:13, fontWeight:500 }}>
                      {ch === 'whatsapp' ? '💬 WhatsApp' : '📧 Email'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
              <button onClick={createAndSend} disabled={sending === 'new' || !form.patient_id} className="btn-primary">
                {sending === 'new' ? 'Envoi...' : form.channel === 'whatsapp' ? '💬 Envoyer par WhatsApp' : '📧 Envoyer par email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
