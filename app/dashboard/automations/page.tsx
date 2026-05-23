'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'

const TYPE_CFG: Record<string,{icon:string;label:string;color:string;bg:string}> = {
  email:    { icon:'📧', label:'Email',    color:'#1D4ED8', bg:'#EFF6FF' },
  whatsapp: { icon:'💬', label:'WhatsApp', color:'#166534', bg:'#F0FDF4' },
  docusign: { icon:'✍️', label:'DocuSign', color:'#6B21A8', bg:'#FAF5FF' },
  document: { icon:'📄', label:'Document', color:'#475569', bg:'#F8FAFC' },
  sms:      { icon:'📱', label:'SMS',      color:'#92400E', bg:'#FFFBEB' },
  yousign:  { icon:'✍️', label:'Yousign',  color:'#0891B2', bg:'#ECFEFF' },
  webhook:  { icon:'🔗', label:'Webhook',  color:'#475569', bg:'#F8FAFC' },
}

export default function AutomationsPage() {
  const supabase = createClient()
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<'all'|'pending'|'sent'|'failed'>('all')

  async function load() {
    let q = supabase
      .from('workflow_executions')
      .select('*, patient:patients(first_name,last_name,phone), step:workflow_steps(type,template_name,timing_days,timing_reference), workflow:workflows(name,treatment:treatments(name,color))')
      .order('scheduled_at', { ascending: true })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setExecutions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function markSent(id: string) {
    await supabase.from('workflow_executions').update({ status:'sent', executed_at: new Date().toISOString() }).eq('id', id)
    setExecutions(prev => prev.map(e => e.id===id ? { ...e, status:'sent', executed_at: new Date().toISOString() } : e))
  }

  const counts = {
    total:   executions.length,
    pending: executions.filter(e => e.status==='pending').length,
    sent:    executions.filter(e => e.status==='sent').length,
    failed:  executions.filter(e => e.status==='failed').length,
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Automatisations</div>
        <div className="page-subtitle">Log des actions automatisées du parcours patient</div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Total', value:counts.total, color:'var(--gray-900)', bg:'var(--gray-50)', border:'var(--gray-200)' },
            { label:'En attente', value:counts.pending, color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
            { label:'Envoyées', value:counts.sent, color:'#059669', bg:'#F0FDF4', border:'#BBF7D0' },
            { label:'Échouées', value:counts.failed, color:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
          ].map((s,i) => (
            <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:s.color, opacity:.7, marginTop:2, fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {(['all','pending','sent','failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filter===f ? 'var(--blue)' : 'white', color: filter===f ? 'white' : 'var(--gray-600)', border: filter===f ? 'none' : '1px solid var(--gray-200)' }}>
              {f==='all'?'Toutes':f==='pending'?'⏳ En attente':f==='sent'?'✅ Envoyées':'❌ Échouées'}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding:60, textAlign:'center' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
          ) : executions.length === 0 ? (
            <div style={{ padding:60, textAlign:'center', color:'var(--gray-400)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
              <div style={{ fontSize:14 }}>Aucune automatisation</div>
            </div>
          ) : (
            <table>
              <thead><tr><th>Patient</th><th>Action</th><th>Workflow</th><th>Planifié</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {executions.map(e => {
                  const tc = TYPE_CFG[e.step?.type] ?? TYPE_CFG.document
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="avatar" style={{ width:28, height:28, fontSize:10 }}>{e.patient?.first_name?.[0]}{e.patient?.last_name?.[0]}</div>
                          <span style={{ fontSize:13, fontWeight:500 }}>{e.patient?.first_name} {e.patient?.last_name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:7, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{tc.icon}</div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:tc.color }}>{tc.label}</div>
                            <div style={{ fontSize:11, color:'var(--gray-500)' }}>{e.step?.template_name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>{e.workflow?.name}</td>
                      <td style={{ fontSize:12, color:'var(--gray-600)' }}>{e.scheduled_at ? formatDateTime(e.scheduled_at) : '—'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99, color: e.status==='sent'?'#059669':e.status==='failed'?'#DC2626':e.status==='pending'?'#D97706':'var(--gray-500)', background: e.status==='sent'?'#F0FDF4':e.status==='failed'?'#FEF2F2':e.status==='pending'?'#FFFBEB':'var(--gray-100)' }}>
                          {e.status==='sent'?'✓ Envoyé':e.status==='failed'?'✗ Échoué':e.status==='pending'?'⏳ En attente':'Ignoré'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          {e.status==='pending' && (
                            <button onClick={() => markSent(e.id)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontWeight:500 }}>
                              ✓ Marquer envoyé
                            </button>
                          )}
                          {e.step?.type==='whatsapp' && e.patient?.phone && (
                            <a href={`https://wa.me/${e.patient.phone.replace(/\D/g,'')}`} target="_blank"
                              style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid #BBF7D0', background:'#F0FDF4', color:'#166534', textDecoration:'none', fontWeight:600 }}>
                              💬
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
