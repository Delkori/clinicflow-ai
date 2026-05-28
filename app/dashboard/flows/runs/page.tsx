'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const STATUS_CFG: Record<string, {label:string;color:string;bg:string}> = {
  running:   { label:'En cours',  color:'#D97706', bg:'#FFFBEB' },
  completed: { label:'Terminé',   color:'#059669', bg:'#F0FDF4' },
  failed:    { label:'Échoué',    color:'#DC2626', bg:'#FEF2F2' },
  paused:    { label:'Pausé',     color:'#0891B2', bg:'#ECFEFF' },
}

const STEP_STATUS: Record<string, string> = {
  pending:   '⏳', running: '🔄', completed: '✅', failed: '❌', skipped: '⏭', waiting: '⏰',
}

export default function FlowRunsPage() {
  const supabase = createClient()
  const [runs, setRuns]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<any>(null)
  const [steps, setSteps]   = useState<any[]>([])
  const [flows, setFlows]   = useState<any[]>([])
  const [filterFlow, setFilterFlow] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      const [{ data: r }, { data: f }] = await Promise.all([
        supabase.from('workflow_runs').select('*, patient:patients(first_name, last_name), workflow:workflow_definitions(name, trigger_type)').order('started_at', { ascending: false }).limit(50),
        supabase.from('workflow_definitions').select('id, name').eq('clinic_id', prof.clinic_id),
      ])
      setRuns(r ?? [])
      setFlows(f ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function loadSteps(runId: string) {
    const { data } = await supabase.from('workflow_run_steps').select('*').eq('run_id', runId).order('started_at')
    setSteps(data ?? [])
  }

  async function selectRun(run: any) {
    setSelectedRun(run)
    await loadSteps(run.id)
  }

  const filtered = filterFlow === 'all' ? runs : runs.filter(r => r.workflow_id === filterFlow)

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* List */}
      <div style={{ width:380, borderRight:'1px solid var(--gray-200)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--gray-100)' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:10 }}>Historique des exécutions</div>
          <select className="input" value={filterFlow} onChange={e => setFilterFlow(e.target.value)} style={{ fontSize:12 }}>
            <option value="all">Tous les workflows</option>
            {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center' }}><div style={{ width:24, height:24, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🏃</div>
              Aucune exécution encore.<br />Activez un workflow pour commencer.
            </div>
          ) : (
            filtered.map(run => {
              const sc = STATUS_CFG[run.status] ?? STATUS_CFG.completed
              const isSelected = selectedRun?.id === run.id
              return (
                <div key={run.id} onClick={() => selectRun(run)}
                  style={{ padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid var(--gray-50)', background: isSelected ? 'var(--blue-light)' : 'white', transition:'background .1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--gray-50)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:5 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{run.workflow?.name}</div>
                    <span style={{ fontSize:10, fontWeight:700, color:sc.color, background:sc.bg, padding:'2px 7px', borderRadius:99, flexShrink:0, marginLeft:8 }}>{sc.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--gray-500)' }}>👤 {run.patient?.first_name} {run.patient?.last_name}</div>
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>{formatDateTime(run.started_at)}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        {!selectedRun ? (
          <div style={{ display:'flex', flex:1, alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--gray-400)' }}>
            <div style={{ fontSize:40 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:500 }}>Sélectionnez une exécution</div>
          </div>
        ) : (
          <>
            <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
                  <Link href="/dashboard/flows" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Workflows</Link> › Historique
                </div>
                <div className="page-title">{selectedRun.workflow?.name}</div>
                <div className="page-subtitle">
                  {selectedRun.patient?.first_name} {selectedRun.patient?.last_name} · {formatDateTime(selectedRun.started_at)}
                </div>
              </div>
              <span style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:99, color:STATUS_CFG[selectedRun.status]?.color, background:STATUS_CFG[selectedRun.status]?.bg }}>
                {STATUS_CFG[selectedRun.status]?.label}
              </span>
            </div>
            <div className="page-content">
              {/* Context */}
              {selectedRun.context && Object.keys(selectedRun.context).length > 0 && (
                <div className="card" style={{ padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:10 }}>Variables de contexte</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {Object.entries(selectedRun.context).filter(([,v]) => v).map(([k,v]) => (
                      <div key={k} style={{ fontSize:11, background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:6, padding:'3px 10px' }}>
                        <span style={{ color:'var(--gray-400)' }}>{k}: </span>
                        <span style={{ color:'var(--gray-700)', fontWeight:500 }}>{String(v).slice(0, 40)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps timeline */}
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:12 }}>Étapes exécutées</div>
              {steps.length === 0 ? (
                <div style={{ color:'var(--gray-400)', fontSize:13, padding:24, textAlign:'center' }}>Aucune étape enregistrée</div>
              ) : (
                <div style={{ position:'relative', paddingLeft:20 }}>
                  <div style={{ position:'absolute', left:27, top:16, bottom:16, width:2, background:'var(--gray-200)', borderRadius:99 }} />
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {steps.map((step, i) => (
                      <div key={step.id} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', background: step.status==='completed'?'#F0FDF4':step.status==='failed'?'#FEF2F2':'var(--gray-100)', border:`2px solid ${step.status==='completed'?'#BBF7D0':step.status==='failed'?'#FECACA':'var(--gray-200)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, zIndex:1 }}>
                          {STEP_STATUS[step.status] ?? '•'}
                        </div>
                        <div className="card" style={{ flex:1, padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>{step.node_type} — <span style={{ color:'var(--gray-500)', fontWeight:400 }}>{step.node_id}</span></div>
                            {step.started_at && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{formatDateTime(step.started_at)}</div>}
                          </div>
                          {step.error && <div style={{ fontSize:12, color:'#DC2626', background:'#FEF2F2', padding:'5px 9px', borderRadius:6, marginTop:5 }}>❌ {step.error}</div>}
                          {step.output_data && Object.keys(step.output_data).length > 0 && (
                            <details style={{ marginTop:5 }}>
                              <summary style={{ fontSize:11, color:'var(--gray-400)', cursor:'pointer' }}>Résultat</summary>
                              <pre style={{ fontSize:10, background:'var(--gray-50)', padding:'8px', borderRadius:6, marginTop:5, overflow:'auto', maxHeight:100 }}>{JSON.stringify(step.output_data, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
