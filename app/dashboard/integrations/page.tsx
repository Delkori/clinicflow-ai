'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'

const PROVIDERS = [
  { id:'n8n',             label:'n8n',              icon:'🔄', color:'#E44B26', bg:'#FFF4F2', desc:'Automation low-code open source' },
  { id:'zapier',          label:'Zapier',           icon:'⚡', color:'#FF4A00', bg:'#FFF3F0', desc:'Connectez 7000+ applications' },
  { id:'make',            label:'Make (Integromat)', icon:'🔷', color:'#6D00CC', bg:'#F5F0FF', desc:'Visual automation platform' },
  { id:'slack',           label:'Slack',            icon:'💬', color:'#4A154B', bg:'#F9F0FA', desc:'Notifications équipe en temps réel' },
  { id:'gmail',           label:'Gmail',            icon:'📧', color:'#EA4335', bg:'#FEF0EF', desc:'Envoi d\'emails via votre compte Gmail' },
  { id:'google_calendar', label:'Google Calendar',  icon:'📅', color:'#1A73E8', bg:'#EFF6FF', desc:'Sync bidirectionnelle des rendez-vous' },
  { id:'notion',          label:'Notion',           icon:'📓', color:'#000000', bg:'#F5F5F5', desc:'Base de données et wikis' },
  { id:'airtable',        label:'Airtable',         icon:'🗃️', color:'#2D7FF9', bg:'#EFF6FF', desc:'Spreadsheet & base de données' },
  { id:'custom',          label:'Webhook custom',   icon:'🔗', color:'#475569', bg:'#F8FAFC', desc:'N\'importe quelle app avec une URL' },
]

const EVENTS = [
  { id:'patient.created',         label:'Patient créé' },
  { id:'consultation.created',    label:'Consultation créée' },
  { id:'consultation.completed',  label:'Consultation complétée' },
  { id:'journey.stage_changed',   label:'Étape de parcours changée' },
  { id:'document.signed',         label:'Document signé' },
  { id:'appointment.created',     label:'RDV créé' },
  { id:'appointment.confirmed',   label:'RDV confirmé' },
  { id:'workflow.step_sent',      label:'Étape de workflow envoyée' },
]

export default function IntegrationsPage() {
  const supabase = createClient()
  const [webhooks, setWebhooks]     = useState<any[]>([])
  const [logs, setLogs]             = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'webhooks'|'logs'>('webhooks')
  const [showModal, setShowModal]   = useState(false)
  const [clinicId, setClinicId]     = useState('')
  const [baseUrl, setBaseUrl]       = useState('')
  const [testingId, setTestingId]   = useState<string|null>(null)
  const [toast, setToast]           = useState<any>(null)

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin)
    const [{ data: wh }, { data: lg }] = await Promise.all([
      supabase.from('webhook_integrations').select('*').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }),
      supabase.from('webhook_logs').select('*, webhook:webhook_integrations(name, provider)').order('created_at', { ascending: false }).limit(30),
    ])
    setWebhooks(wh ?? [])
    setLogs(lg ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleWebhook(id: string, current: boolean) {
    await supabase.from('webhook_integrations').update({ is_active: !current }).eq('id', id)
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w))
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Supprimer cette intégration ?')) return
    await supabase.from('webhook_integrations').delete().eq('id', id)
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  async function testWebhook(webhook: any) {
    setTestingId(webhook.id)
    const res = await fetch('/api/webhooks/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'patient.created',
        clinic_id: clinicId,
        data: { patient_name: 'Test Patient', email: 'test@clinicflow.ai', source: 'test' },
      }),
    })
    const data = await res.json()
    setTestingId(null)
    showToast(data.fired > 0 ? `✓ Test envoyé — réponse reçue` : 'Aucun webhook actif pour cet événement')
    await load()
  }

  const providerInfo = (id: string) => PROVIDERS.find(p => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1]

  return (
    <div style={{ position:'relative' }}>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.type==='error' ? '#450A0A' : '#022C22', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Intégrations & Webhooks</div>
          <div className="page-subtitle">Connectez ClinicFlow à n'importe quelle application</div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize:13 }}>
          + Nouvelle intégration
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 32px' }}>
        {([['webhooks','⚡ Webhooks'], ['logs','📋 Logs']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {tab === 'webhooks' && (
          <>
            {/* Available integrations showcase */}
            {webhooks.length === 0 && (
              <div className="card" style={{ padding:24, marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:14 }}>Intégrations disponibles</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {PROVIDERS.map(p => (
                    <div key={p.id} onClick={() => setShowModal(true)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:p.bg, borderRadius:9, cursor:'pointer', border:`1px solid ${p.color}20`, transition:'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                      <span style={{ fontSize:18 }}>{p.icon}</span>
                      <span style={{ fontSize:12.5, fontWeight:600, color:p.color }}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {webhooks.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucune intégration configurée</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20, maxWidth:360, margin:'0 auto 20px' }}>
                  Connectez n8n, Zapier, Slack ou n'importe quelle app via webhooks pour automatiser vos processus
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary">+ Créer la première intégration</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {webhooks.map(wh => {
                  const pi = providerInfo(wh.provider)
                  const inboundUrl = `${baseUrl}/api/webhooks/inbound/${wh.id}`
                  return (
                    <div key={wh.id} className="card" style={{ padding:'16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:pi.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{pi.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{wh.name}</span>
                            <span style={{ fontSize:11, background: wh.is_active ? '#DCFCE7' : 'var(--gray-100)', color: wh.is_active ? '#166534' : 'var(--gray-500)', padding:'1px 8px', borderRadius:99, fontWeight:600 }}>
                              {wh.is_active ? '● Actif' : '○ Inactif'}
                            </span>
                            <span style={{ fontSize:11, color:'var(--gray-500)', background:pi.bg, padding:'1px 8px', borderRadius:99 }}>{pi.label}</span>
                            <span style={{ fontSize:11, color:'var(--gray-400)', background:'var(--gray-100)', padding:'1px 8px', borderRadius:99 }}>
                              {wh.direction === 'outbound' ? '↗ Sortant' : wh.direction === 'inbound' ? '↙ Entrant' : '↔ Bidirectionnel'}
                            </span>
                          </div>
                          {wh.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3 }}>{wh.description}</div>}
                          <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                            {(wh.events ?? []).map((ev: string) => (
                              <span key={ev} style={{ fontSize:10, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'1px 6px', borderRadius:4, fontWeight:500 }}>
                                {EVENTS.find(e => e.id === ev)?.label ?? ev}
                              </span>
                            ))}
                          </div>
                          {wh.direction !== 'outbound' && (
                            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:11, color:'var(--gray-500)' }}>URL entrante :</span>
                              <code style={{ fontSize:10, background:'var(--gray-100)', padding:'2px 8px', borderRadius:4, color:'var(--gray-700)', userSelect:'all' }}>{inboundUrl}</code>
                              <button onClick={() => navigator.clipboard.writeText(inboundUrl).then(() => showToast('URL copiée'))}
                                style={{ fontSize:10, padding:'2px 6px', borderRadius:4, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer' }}>📋</button>
                            </div>
                          )}
                          {wh.last_triggered_at && (
                            <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:6 }}>
                              Dernier envoi : {formatDateTime(wh.last_triggered_at)} · {wh.trigger_count} total
                            </div>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          <button onClick={() => testWebhook(wh)} disabled={testingId === wh.id} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-600)' }}>
                            {testingId === wh.id ? '...' : '🧪 Test'}
                          </button>
                          <button onClick={() => toggleWebhook(wh.id, wh.is_active)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color: wh.is_active ? '#DC2626' : '#059669' }}>
                            {wh.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button onClick={() => deleteWebhook(wh.id)} style={{ fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)' }}>🗑</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'logs' && (
          <div className="table-wrap">
            {logs.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucun log de webhook</div>
            ) : (
              <table>
                <thead><tr>
                  <th>Webhook</th><th>Événement</th><th>Direction</th><th>Statut</th><th>Date</th><th>Durée</th>
                </tr></thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize:13 }}>{log.webhook?.name ?? '—'}</td>
                      <td><span style={{ fontSize:11, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'2px 7px', borderRadius:4, fontWeight:500 }}>{log.event}</span></td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>{log.direction === 'outbound' ? '↗ Sortant' : '↙ Entrant'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, color: log.response_status >= 200 && log.response_status < 300 ? '#059669' : '#DC2626', background: log.response_status >= 200 && log.response_status < 300 ? '#F0FDF4' : '#FEF2F2', padding:'2px 7px', borderRadius:99 }}>
                          {log.error ? '✗ Erreur' : `✓ ${log.response_status}`}
                        </span>
                      </td>
                      <td style={{ fontSize:11, color:'var(--gray-500)' }}>{formatDateTime(log.created_at)}</td>
                      <td style={{ fontSize:11, color:'var(--gray-400)' }}>{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NewWebhookModal
          clinicId={clinicId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function NewWebhookModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '', description: '', provider: 'custom', direction: 'outbound', url: '',
    secret: '', events: [] as string[], headers: '{}',
  })
  const [loading, setLoading] = useState(false)
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  function toggleEvent(id: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(id) ? f.events.filter(e => e !== id) : [...f.events, id]
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    let headers = {}
    try { headers = JSON.parse(form.headers) } catch {}
    await supabase.from('webhook_integrations').insert({
      clinic_id: clinicId, name: form.name, description: form.description || null,
      provider: form.provider, direction: form.direction,
      url: form.url || null, secret: form.secret || null,
      events: form.events, headers,
    })
    setLoading(false)
    onCreated()
  }

  const pi = PROVIDERS.find(p => p.id === form.provider) ?? PROVIDERS[PROVIDERS.length-1]

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:580 }}>
        <div className="modal-header">
          <div className="modal-title">Nouvelle intégration</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:'65vh', overflowY:'auto' }}>
            <div>
              <label className="label">Application *</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {PROVIDERS.map(p => (
                  <div key={p.id} onClick={() => setForm(f => ({ ...f, provider: p.id }))}
                    style={{ padding:'10px 8px', borderRadius:9, cursor:'pointer', border:`1.5px solid ${form.provider===p.id ? p.color : 'var(--gray-200)'}`, background: form.provider===p.id ? p.bg : 'white', textAlign:'center', transition:'all .1s' }}>
                    <div style={{ fontSize:20 }}>{p.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, color: form.provider===p.id ? p.color : 'var(--gray-600)', marginTop:4 }}>{p.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={form.name} onChange={up('name')} required placeholder={`${pi.label} — Mon intégration`} />
              </div>
              <div>
                <label className="label">Direction</label>
                <select className="input" value={form.direction} onChange={up('direction')}>
                  <option value="outbound">↗ Sortant (vers l'app)</option>
                  <option value="inbound">↙ Entrant (depuis l'app)</option>
                  <option value="both">↔ Bidirectionnel</option>
                </select>
              </div>
            </div>
            {(form.direction === 'outbound' || form.direction === 'both') && (
              <div>
                <label className="label">URL du webhook</label>
                <input className="input" value={form.url} onChange={up('url')} placeholder="https://hooks.zapier.com/hooks/catch/..." />
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>URL fournie par {pi.label} pour recevoir les événements</div>
              </div>
            )}
            <div>
              <label className="label">Événements déclencheurs</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
                {EVENTS.map(ev => (
                  <label key={ev.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, cursor:'pointer', background: form.events.includes(ev.id) ? 'var(--blue-light)' : 'var(--gray-50)', border:`1px solid ${form.events.includes(ev.id) ? 'var(--blue-mid)' : 'transparent'}` }}>
                    <input type="checkbox" checked={form.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} style={{ accentColor:'var(--blue)', cursor:'pointer' }} />
                    <span style={{ fontSize:12, color: form.events.includes(ev.id) ? 'var(--blue-dark)' : 'var(--gray-700)', fontWeight: form.events.includes(ev.id) ? 500 : 400 }}>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Secret / clé de sécurité</label>
              <input className="input" type="password" value={form.secret} onChange={up('secret')} placeholder="Optionnel — envoyé dans X-ClinicFlow-Signature" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Création...' : 'Créer l\'intégration'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
