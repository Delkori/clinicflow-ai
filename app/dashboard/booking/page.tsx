'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'

export default function BookingDashboard() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'requests'|'settings'>('requests')
  const [clinicId, setClinicId] = useState('')
  const [baseUrl, setBaseUrl]   = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [copied, setCopied]     = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin)

    const [{ data: reqs }, { data: sett }] = await Promise.all([
      supabase.from('booking_requests').select('*, treatment:treatments(name,color)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }),
      supabase.from('booking_settings').select('*').eq('clinic_id', prof.clinic_id).single(),
    ])
    setRequests(reqs ?? [])
    setSettings(sett)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    await supabase.from('booking_requests').update({ status }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    if (settings.id) {
      await supabase.from('booking_settings').update({ title: settings.title, description: settings.description, is_active: settings.is_active, slot_duration_minutes: settings.slot_duration_minutes }).eq('id', settings.id)
    }
    setSavingSettings(false)
  }

  const bookingUrl = settings ? `${baseUrl}/rdv/${settings.slug}` : ''

  const STATUS_CFG: Record<string, {label:string;color:string;bg:string}> = {
    pending:   { label:'En attente', color:'#D97706', bg:'#FFFBEB' },
    confirmed: { label:'Confirmé',   color:'#059669', bg:'#F0FDF4' },
    cancelled: { label:'Annulé',     color:'#DC2626', bg:'#FEF2F2' },
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Prise de rendez-vous en ligne</div>
          <div className="page-subtitle">Gérez votre agenda public — remplacez Doctolib</div>
        </div>
        {settings?.is_active && bookingUrl && (
          <div style={{ display:'flex', gap:8 }}>
            <a href={bookingUrl} target="_blank" className="btn-secondary" style={{ textDecoration:'none', fontSize:13, display:'flex', gap:6, alignItems:'center' }}>
              👁 Voir la page
            </a>
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="btn-primary" style={{ fontSize:13 }}>
              {copied ? '✓ Copié !' : '🔗 Copier le lien'}
            </button>
          </div>
        )}
      </div>

      {/* Link banner */}
      {bookingUrl && (
        <div style={{ margin:'0 32px 0', padding:'12px 16px', background:'var(--blue-light)', border:'1px solid var(--blue-mid)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:16 }}>🔗</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--blue-dark)' }}>Lien de prise de RDV à partager avec vos patients</div>
              <code style={{ fontSize:12, color:'var(--blue)', userSelect:'all' }}>{bookingUrl}</code>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: settings?.is_active ? '#10B981' : '#EF4444', animation: settings?.is_active ? 'pulse 2s infinite' : 'none' }} />
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            <span style={{ fontSize:12, fontWeight:600, color: settings?.is_active ? '#059669' : '#DC2626' }}>{settings?.is_active ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 32px', marginTop:16 }}>
        {([['requests', `📋 Demandes (${requests.length})`], ['settings', '⚙ Configuration']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {tab === 'requests' && (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              {[
                { label:'Total demandes', value: requests.length, color:'var(--blue)', bg:'var(--blue-light)' },
                { label:'En attente', value: requests.filter(r => r.status==='pending').length, color:'#D97706', bg:'#FFFBEB' },
                { label:'Confirmées', value: requests.filter(r => r.status==='confirmed').length, color:'#059669', bg:'#F0FDF4' },
              ].map((s,i) => (
                <div key={i} className="card" style={{ padding:'16px 18px' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3, fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {requests.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucune demande de RDV</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Partagez votre lien de prise de RDV avec vos patients</div>
                {bookingUrl && (
                  <button onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="btn-primary" style={{ fontSize:13 }}>
                    🔗 Copier le lien
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Date souhaitée</th><th>Type</th><th>Contact</th><th>Demande</th><th>Statut</th><th></th></tr></thead>
                  <tbody>
                    {requests.map(r => {
                      const sc = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight:500, fontSize:14, color:'var(--gray-900)' }}>{r.first_name} {r.last_name}</div>
                          </td>
                          <td>
                            <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)' }}>
                              {new Date(r.requested_date).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })}
                            </div>
                            <div style={{ fontSize:12, color:'var(--gray-500)' }}>à {r.requested_time}</div>
                          </td>
                          <td>
                            <span style={{ fontSize:12, color:'var(--blue)', background:'var(--blue-light)', padding:'2px 8px', borderRadius:99, fontWeight:500 }}>{r.appointment_type}</span>
                          </td>
                          <td>
                            <div style={{ fontSize:12, color:'var(--gray-700)' }}>{r.email}</div>
                            {r.phone && <div style={{ fontSize:11, color:'var(--gray-500)' }}>{r.phone}</div>}
                          </td>
                          <td style={{ fontSize:11, color:'var(--gray-500)' }}>{formatDateTime(r.created_at)}</td>
                          <td>
                            <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                              style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:`1px solid ${sc.color}40`, background:sc.bg, color:sc.color, cursor:'pointer', fontWeight:600 }}>
                              {Object.entries(STATUS_CFG).map(([s, c]) => <option key={s} value={s}>{c.label}</option>)}
                            </select>
                          </td>
                          <td>
                            {r.phone && (
                              <a href={`https://wa.me/${r.phone.replace(/\D/g,'')}`} target="_blank"
                                style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'#F0FDF4', color:'#166534', border:'1px solid #BBF7D0', textDecoration:'none', fontWeight:600 }}>
                                💬 WA
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'settings' && settings && (
          <div style={{ maxWidth:520 }}>
            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:16 }}>Configuration de la page</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--gray-50)', borderRadius:9 }}>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:500, color:'var(--gray-900)' }}>Page de réservation active</div>
                    <div style={{ fontSize:12, color:'var(--gray-500)' }}>Les patients peuvent prendre RDV en ligne</div>
                  </div>
                  <label style={{ position:'relative', display:'inline-block', width:44, height:24, cursor:'pointer' }}>
                    <input type="checkbox" checked={settings.is_active} onChange={e => setSettings((s: any) => ({ ...s, is_active: e.target.checked }))} style={{ opacity:0, width:0, height:0 }} />
                    <span style={{ position:'absolute', inset:0, borderRadius:99, background: settings.is_active ? 'var(--blue)' : 'var(--gray-300)', transition:'background .2s' }}>
                      <span style={{ position:'absolute', width:18, height:18, borderRadius:'50%', background:'white', top:3, left: settings.is_active ? 23 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                    </span>
                  </label>
                </div>
                <div>
                  <label className="label">Titre de la page</label>
                  <input className="input" value={settings.title ?? ''} onChange={e => setSettings((s: any) => ({ ...s, title: e.target.value }))} placeholder={settings.clinic?.name} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input" value={settings.description ?? ''} onChange={e => setSettings((s: any) => ({ ...s, description: e.target.value }))} rows={2} style={{ resize:'none' }} placeholder="Prenez rendez-vous avec notre équipe..." />
                </div>
                <div>
                  <label className="label">Durée des créneaux (minutes)</label>
                  <select className="input" value={settings.slot_duration_minutes ?? 30} onChange={e => setSettings((s: any) => ({ ...s, slot_duration_minutes: parseInt(e.target.value) }))}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                  </select>
                </div>
                <div>
                  <label className="label">URL de votre page</label>
                  <div style={{ display:'flex', gap:6 }}>
                    <div style={{ flex:1, padding:'8px 12px', background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:8, fontSize:13, color:'var(--gray-600)', fontFamily:'monospace', userSelect:'all', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {bookingUrl}
                    </div>
                    <a href={bookingUrl} target="_blank" style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--gray-200)', background:'white', fontSize:12, color:'var(--blue)', textDecoration:'none', whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>
                      Ouvrir ↗
                    </a>
                  </div>
                </div>
                <button onClick={saveSettings} disabled={savingSettings} className="btn-primary" style={{ width:'fit-content', fontSize:13 }}>
                  {savingSettings ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
