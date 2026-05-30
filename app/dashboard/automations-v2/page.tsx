'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

export default function AutomationsPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <AutomationsContent />
    </Suspense>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string,{icon:string;label:string;color:string;bg:string}> = {
  email:    { icon:'📧', label:'Email',    color:'#1D4ED8', bg:'#EFF6FF' },
  whatsapp: { icon:'💬', label:'WhatsApp', color:'#166534', bg:'#F0FDF4' },
  sms:      { icon:'📱', label:'SMS',      color:'#92400E', bg:'#FFFBEB' },
  yousign:  { icon:'✍️', label:'Yousign',  color:'#0891B2', bg:'#ECFEFF' },
  webhook:  { icon:'🔗', label:'Webhook',  color:'#475569', bg:'#F8FAFC' },
  document: { icon:'📄', label:'Document', color:'#475569', bg:'#F8FAFC' },
}

const PROVIDERS = [
  { id:'ClinicFlow Flows',             label:'ClinicFlow Flows',              icon:'🔄', color:'#E44B26', bg:'#FFF4F2' },
  { id:'zapier',          label:'Zapier',           icon:'⚡', color:'#FF4A00', bg:'#FFF3F0' },
  { id:'make',            label:'Make',             icon:'🔷', color:'#6D00CC', bg:'#F5F0FF' },
  { id:'slack',           label:'Slack',            icon:'💬', color:'#4A154B', bg:'#F9F0FA' },
  { id:'gmail',           label:'Gmail',            icon:'📧', color:'#EA4335', bg:'#FEF0EF' },
  { id:'google_calendar', label:'Google Calendar',  icon:'📅', color:'#1A73E8', bg:'#EFF6FF' },
  { id:'notion',          label:'Notion',           icon:'📓', color:'#000000', bg:'#F5F5F5' },
  { id:'airtable',        label:'Airtable',         icon:'🗃️', color:'#2D7FF9', bg:'#EFF6FF' },
  { id:'custom',          label:'Webhook custom',   icon:'🔗', color:'#475569', bg:'#F8FAFC' },
]

const EVENTS = [
  { id:'patient.created',         label:'Patient créé' },
  { id:'consultation.created',    label:'Consultation créée' },
  { id:'consultation.completed',  label:'Consultation complétée' },
  { id:'journey.stage_changed',   label:'Étape parcours changée' },
  { id:'document.signed',         label:'Document signé' },
  { id:'appointment.created',     label:'RDV créé' },
  { id:'appointment.confirmed',   label:'RDV confirmé' },
  { id:'workflow.step_sent',      label:'Étape workflow envoyée' },
]

const TRIGGER_CFG: Record<string,{label:string;icon:string;color:string;bg:string}> = {
  consultation_created:   { label:'Consultation créée',  icon:'✦', color:'#1D4ED8', bg:'#EFF6FF' },
  consultation_completed: { label:'Consultation terminée',icon:'✅', color:'#059669', bg:'#F0FDF4' },
  document_signed:        { label:'Document signé',      icon:'✍️', color:'#6B21A8', bg:'#FAF5FF' },
  journey_stage_changed:  { label:'Étape changée',       icon:'🗺️', color:'#D97706', bg:'#FFFBEB' },
  appointment_confirmed:  { label:'RDV confirmé',        icon:'📅', color:'#0891B2', bg:'#ECFEFF' },
  appointment_created:    { label:'RDV créé',            icon:'📅', color:'#0891B2', bg:'#ECFEFF' },
  patient_created:        { label:'Patient créé',        icon:'◎',  color:'#475569', bg:'#F8FAFC' },
  form_completed:         { label:'Formulaire complété', icon:'📋', color:'#059669', bg:'#F0FDF4' },
  manual:                 { label:'Manuel',              icon:'▶',  color:'#475569', bg:'#F8FAFC' },
}

const RUN_STATUS: Record<string,{label:string;color:string;bg:string}> = {
  running:   { label:'En cours',  color:'#D97706', bg:'#FFFBEB' },
  completed: { label:'Terminé',   color:'#059669', bg:'#F0FDF4' },
  failed:    { label:'Échoué',    color:'#DC2626', bg:'#FEF2F2' },
  paused:    { label:'Pausé',     color:'#0891B2', bg:'#ECFEFF' },
}

function AutomationsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'flows') as 'flows'|'logs'|'connectors'
  const setTab = (t: string) => router.replace(`/dashboard/automations-v2?tab=${t}`)

  const supabase = createClient()
  const [clinicId, setClinicId] = useState('')
  const [role, setRole] = useState('medecin')

  // Flows state
  const [flows, setFlows] = useState<any[]>([])
  const [showNewFlow, setShowNewFlow] = useState(false)

  // Logs state
  const [executions, setExecutions] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRun, setSelectedRun] = useState<any>(null)
  const [runSteps, setRunSteps] = useState<any[]>([])
  const [execFilter, setExecFilter] = useState<'all'|'pending'|'sent'|'failed'>('all')

  // Connectors state
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [webhookLogs, setWebhookLogs] = useState<any[]>([])
  const [showNewWebhook, setShowNewWebhook] = useState(false)
  const [connectorTab, setConnectorTab] = useState<'webhooks'|'logs'>('webhooks')
  const [testingId, setTestingId] = useState<string|null>(null)
  const [toast, setToast] = useState<any>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id, role').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    setRole(prof.role ?? 'medecin')

    await Promise.all([
      supabase.from('workflow_definitions').select('*, treatment:treatments(name,color)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }).then(({ data }) => setFlows(data ?? [])),
      supabase.from('workflow_executions').select('*, patient:patients(first_name,last_name,phone), step:workflow_steps(type,template_name), workflow:workflows(name)').order('scheduled_at', { ascending: true }).then(({ data }) => setExecutions(data ?? [])),
      supabase.from('workflow_runs').select('*, patient:patients(first_name,last_name), workflow:workflow_definitions(name, trigger_type)').order('started_at', { ascending: false }).limit(40).then(({ data }) => setRuns(data ?? [])),
      supabase.from('webhook_integrations').select('*').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }).then(({ data }) => setWebhooks(data ?? [])),
    ])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadRunSteps(runId: string) {
    const { data } = await supabase.from('workflow_run_steps').select('*').eq('run_id', runId).order('started_at')
    setRunSteps(data ?? [])
  }

  async function toggleFlow(id: string, current: boolean) {
    await supabase.from('workflow_definitions').update({ is_active: !current }).eq('id', id)
    setFlows(prev => prev.map(f => f.id === id ? { ...f, is_active: !current } : f))
  }

  async function deleteFlow(id: string) {
    if (!confirm('Supprimer ce workflow ?')) return
    await supabase.from('workflow_definitions').delete().eq('id', id)
    setFlows(prev => prev.filter(f => f.id !== id))
  }

  async function toggleWebhook(id: string, current: boolean) {
    await supabase.from('webhook_integrations').update({ is_active: !current }).eq('id', id)
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w))
  }

  async function testWebhook(webhook: any) {
    setTestingId(webhook.id)
    const res = await fetch('/api/webhooks/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'patient.created', clinic_id: clinicId, data: { patient_name: 'Test', email: 'test@test.com' } }),
    })
    const data = await res.json()
    setTestingId(null)
    showToast(data.fired > 0 ? '✓ Test envoyé' : 'Aucun webhook actif pour cet événement')
    load()
  }

  async function markExecSent(id: string) {
    await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', id)
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, status: 'sent' } : e))
  }

  const filteredExec = execFilter === 'all' ? executions : executions.filter(e => e.status === execFilter)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', position:'relative' }}>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Automatisations</div>
          <div className="page-subtitle">
            {flows.filter(f => f.is_active).length} workflow{flows.filter(f => f.is_active).length > 1 ? 's' : ''} actif{flows.filter(f => f.is_active).length > 1 ? 's' : ''} ·{' '}
            {executions.filter(e => e.status === 'pending').length} action{executions.filter(e => e.status === 'pending').length > 1 ? 's' : ''} en attente ·{' '}
            {webhooks.filter(w => w.is_active).length} connecteur{webhooks.filter(w => w.is_active).length > 1 ? 's' : ''}
          </div>
        </div>
        {tab === 'flows' && (
          <button onClick={() => setShowNewFlow(true)} className="btn-primary" style={{ fontSize:13 }}>+ Nouveau workflow</button>
        )}
        {tab === 'connectors' && (
          <button onClick={() => setShowNewWebhook(true)} className="btn-primary" style={{ fontSize:13 }}>+ Nouvelle connexion</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 32px', flexShrink:0 }}>
        {([
          ['flows',      `⚡ Workflows (${flows.length})`],
          ['logs',       `📋 Logs & Exécutions`],
          ['connectors', `🔌 Connecteurs (${webhooks.length})`],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto' }}>

        {/* ── TAB: FLOWS ── */}
        {tab === 'flows' && (
          <div className="page-content">
            {/* Banner */}
            <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', borderRadius:14, padding:'18px 22px', marginBottom:20, display:'flex', gap:16, alignItems:'center' }}>
              <div style={{ fontSize:32, flexShrink:0 }}>⚡</div>
              <div style={{ flex:1 }}>
                <div style={{ color:'white', fontSize:14, fontWeight:700, marginBottom:2 }}>Automatisez votre parcours patient</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>Glissez-déposez des nœuds : email, WhatsApp, PDF, signature, condition, délai...</div>
              </div>
              <Link href="/dashboard/flows" style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', color:'white', textDecoration:'none', fontWeight:600, flexShrink:0 }}>
                Ouvrir le builder →
              </Link>
            </div>

            {flows.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>⬡</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucun workflow encore</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Créez votre premier workflow pour automatiser le suivi patient</div>
                <button onClick={() => setShowNewFlow(true)} className="btn-primary">Créer mon premier workflow</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {flows.map(flow => {
                  const tc = TRIGGER_CFG[flow.trigger_type] ?? TRIGGER_CFG.manual
                  return (
                    <div key={flow.id} className="card" style={{ padding:'14px 18px', display:'flex', gap:12, alignItems:'center' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: flow.is_active ? '#10B981' : 'var(--gray-300)', flexShrink:0, boxShadow: flow.is_active ? '0 0 0 3px #D1FAE5' : 'none' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{flow.name}</span>
                          {flow.treatment && <span style={{ fontSize:11, color:flow.treatment.color, background:`${flow.treatment.color}15`, padding:'1px 8px', borderRadius:99, fontWeight:500 }}>{flow.treatment.name}</span>}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, padding:'2px 8px', borderRadius:99 }}>{tc.icon} {tc.label}</span>
                          <span style={{ fontSize:11, color:'var(--gray-500)', background:'var(--gray-100)', padding:'2px 8px', borderRadius:99 }}>{(flow.nodes ?? []).length} nœuds</span>
                          {flow.run_count > 0 && <span style={{ fontSize:11, color:'#059669', background:'#F0FDF4', padding:'2px 8px', borderRadius:99 }}>✓ {flow.run_count} exéc.</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                        <Link href={`/dashboard/flows/${flow.id}`} className="btn-secondary" style={{ textDecoration:'none', fontSize:12, padding:'5px 12px' }}>✏️ Éditer</Link>
                        <label style={{ cursor:'pointer', display:'flex', alignItems:'center' }}>
                          <span onClick={() => toggleFlow(flow.id, flow.is_active)}
                            style={{ position:'relative', display:'inline-block', width:36, height:20 }}>
                            <span style={{ position:'absolute', inset:0, borderRadius:99, background: flow.is_active ? '#10B981' : 'var(--gray-300)', transition:'background .2s' }}>
                              <span style={{ position:'absolute', width:14, height:14, borderRadius:'50%', background:'white', top:3, left: flow.is_active ? 19 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                            </span>
                          </span>
                        </label>
                        <button onClick={() => deleteFlow(flow.id)} style={{ fontSize:12, padding:'5px 8px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor='#FECACA'; e.currentTarget.style.color='#EF4444' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.color='var(--gray-400)' }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: LOGS ── */}
        {tab === 'logs' && (
          <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
            {/* Left: executions + runs */}
            <div style={{ width:360, borderRight:'1px solid var(--gray-200)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
              {/* Sub-tabs */}
              <div style={{ borderBottom:'1px solid var(--gray-100)', padding:'0 12px', display:'flex', gap:0, flexShrink:0 }}>
                {(['pending_actions', 'workflow_runs'] as const).map((st, i) => {
                  const active = (i === 0 && !selectedRun) || (i === 1 && !!selectedRun)
                  return null // managed by selectedRun state
                })}
              </div>
              {/* Filter bar */}
              <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--gray-100)', display:'flex', gap:4, flexShrink:0, flexWrap:'wrap' }}>
                {(['all','pending','sent','failed'] as const).map(f => (
                  <button key={f} onClick={() => setExecFilter(f)} style={{ padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', background: execFilter===f ? 'var(--blue)' : 'white', color: execFilter===f ? 'white' : 'var(--gray-600)', border: execFilter===f ? 'none' : '1px solid var(--gray-200)' }}>
                    {f==='all'?'Tout':f==='pending'?`⏳ Attente (${executions.filter(e=>e.status==='pending').length})`:f==='sent'?`✓ Envoyé`:f==='failed'?`✗ Échec`:''}
                  </button>
                ))}
              </div>
              {/* Exec list */}
              <div style={{ flex:1, overflowY:'auto' }}>
                <div style={{ padding:'6px 8px', fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.07em' }}>Actions workflow</div>
                {filteredExec.slice(0,30).map(e => {
                  const tc = TYPE_CFG[e.step?.type] ?? TYPE_CFG.document
                  return (
                    <div key={e.id} style={{ padding:'8px 12px', borderBottom:'1px solid var(--gray-50)', display:'flex', gap:8, alignItems:'center' }}>
                      <div style={{ width:26, height:26, borderRadius:7, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>{tc.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.patient?.first_name} {e.patient?.last_name}</div>
                        <div style={{ fontSize:10, color:'var(--gray-400)' }}>{e.step?.template_name}</div>
                      </div>
                      <div style={{ display:'flex', gap:4, flexShrink:0, alignItems:'center' }}>
                        <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:99, color: e.status==='sent'?'#059669':e.status==='failed'?'#DC2626':'#D97706', background: e.status==='sent'?'#F0FDF4':e.status==='failed'?'#FEF2F2':'#FFFBEB' }}>
                          {e.status==='sent'?'✓':e.status==='failed'?'✗':'⏳'}
                        </span>
                        {e.status==='pending' && <button onClick={() => markExecSent(e.id)} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'none', background:'var(--blue)', color:'white', cursor:'pointer' }}>Marquer</button>}
                        {e.step?.type==='whatsapp' && e.patient?.phone && (
                          <a href={`https://wa.me/${e.patient.phone.replace(/\D/g,'')}`} target="_blank" style={{ fontSize:11, padding:'2px 5px', borderRadius:5, background:'#F0FDF4', color:'#166534', textDecoration:'none', fontWeight:700 }}>💬</a>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding:'6px 8px', fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.07em', borderTop:'1px solid var(--gray-100)', marginTop:4 }}>Exécutions workflow</div>
                {runs.map(run => {
                  const rc = RUN_STATUS[run.status] ?? RUN_STATUS.completed
                  return (
                    <div key={run.id} onClick={() => { setSelectedRun(run); loadRunSteps(run.id) }}
                      style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--gray-50)', background: selectedRun?.id===run.id ? 'var(--blue-light)' : 'white' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:12, fontWeight:500, color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{run.workflow?.name}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:99, color:rc.color, background:rc.bg, flexShrink:0 }}>{rc.label}</span>
                      </div>
                      <div style={{ fontSize:10, color:'var(--gray-400)' }}>{run.patient?.first_name} {run.patient?.last_name} · {formatDateTime(run.started_at)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: run detail */}
            <div style={{ flex:1, overflow:'auto', background:'var(--gray-50)' }}>
              {!selectedRun ? (
                <div style={{ display:'flex', flex:1, alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--gray-400)', height:'100%', padding:40 }}>
                  <div style={{ fontSize:32 }}>📋</div>
                  <div style={{ fontSize:13, fontWeight:500 }}>Sélectionnez une exécution</div>
                  <div style={{ fontSize:12, textAlign:'center', maxWidth:260 }}>Cliquez sur un run dans la liste pour voir le détail des étapes exécutées</div>
                </div>
              ) : (
                <div style={{ padding:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:'var(--gray-900)' }}>{selectedRun.workflow?.name}</div>
                      <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{selectedRun.patient?.first_name} {selectedRun.patient?.last_name} · {formatDateTime(selectedRun.started_at)}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:99, color:RUN_STATUS[selectedRun.status]?.color, background:RUN_STATUS[selectedRun.status]?.bg }}>
                      {RUN_STATUS[selectedRun.status]?.label}
                    </span>
                  </div>
                  {/* Steps timeline */}
                  <div style={{ position:'relative', paddingLeft:16 }}>
                    <div style={{ position:'absolute', left:23, top:12, bottom:12, width:2, background:'var(--gray-200)', borderRadius:99 }} />
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {runSteps.map(step => (
                        <div key={step.id} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                          <div style={{ width:30, height:30, borderRadius:'50%', background: step.status==='completed'?'#F0FDF4':step.status==='failed'?'#FEF2F2':'var(--gray-100)', border:`2px solid ${step.status==='completed'?'#BBF7D0':step.status==='failed'?'#FECACA':'var(--gray-200)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0, zIndex:1 }}>
                            {step.status==='completed'?'✅':step.status==='failed'?'❌':step.status==='waiting'?'⏰':'🔄'}
                          </div>
                          <div className="card" style={{ flex:1, padding:'10px 12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:step.error?6:0 }}>
                              <span style={{ fontSize:12.5, fontWeight:600, color:'var(--gray-900)' }}>{step.node_type}</span>
                              {step.started_at && <span style={{ fontSize:10, color:'var(--gray-400)' }}>{formatDateTime(step.started_at)}</span>}
                            </div>
                            {step.error && <div style={{ fontSize:11, color:'#DC2626', background:'#FEF2F2', padding:'4px 8px', borderRadius:5 }}>❌ {step.error}</div>}
                          </div>
                        </div>
                      ))}
                      {runSteps.length === 0 && <div style={{ color:'var(--gray-400)', fontSize:12, padding:16, textAlign:'center' }}>Aucune étape enregistrée</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: CONNECTORS ── */}
        {tab === 'connectors' && (
          <div className="page-content">
            {/* Sub-tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {([['webhooks','🔌 Connexions'], ['logs','📋 Logs']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setConnectorTab(id)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: connectorTab===id ? 'var(--blue)' : 'white', color: connectorTab===id ? 'white' : 'var(--gray-600)', border: connectorTab===id ? 'none' : '1px solid var(--gray-200)' }}>
                  {label}
                </button>
              ))}
            </div>

            {connectorTab === 'webhooks' && (
              <>
                {/* Quick connect grid */}
                {webhooks.length === 0 && (
                  <div className="card" style={{ padding:18, marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:10 }}>Connexions disponibles — cliquez pour configurer</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => setShowNewWebhook(true)}
                          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:p.bg, borderRadius:8, cursor:'pointer', border:`1px solid ${p.color}20`, transition:'all .15s' }}
                          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                          <span style={{ fontSize:16 }}>{p.icon}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:p.color }}>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {webhooks.length === 0 ? (
                  <div className="card" style={{ padding:40, textAlign:'center' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>🔌</div>
                    <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucune connexion encore</div>
                    <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:16, maxWidth:320, margin:'0 auto 16px' }}>Connectez ClinicFlow Flows, Zapier, Slack ou n'importe quelle app</div>
                    <button onClick={() => setShowNewWebhook(true)} className="btn-primary" style={{ fontSize:13 }}>+ Créer une connexion</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {webhooks.map(wh => {
                      const pi = PROVIDERS.find(p => p.id === wh.provider) ?? PROVIDERS[PROVIDERS.length-1]
                      return (
                        <div key={wh.id} className="card" style={{ padding:'14px 18px' }}>
                          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                            <div style={{ width:36, height:36, borderRadius:9, background:pi.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{pi.icon}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                                <span style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)' }}>{wh.name}</span>
                                <span style={{ fontSize:10, fontWeight:600, background: wh.is_active?'#DCFCE7':'var(--gray-100)', color: wh.is_active?'#166534':'var(--gray-500)', padding:'1px 7px', borderRadius:99 }}>{wh.is_active?'● Actif':'○ Inactif'}</span>
                                <span style={{ fontSize:10, color:'var(--gray-400)', background:'var(--gray-100)', padding:'1px 7px', borderRadius:99 }}>{wh.direction==='outbound'?'↗ Sortant':'↙ Entrant'}</span>
                              </div>
                              {(wh.events ?? []).length > 0 && (
                                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
                                  {wh.events.slice(0,3).map((ev: string) => (
                                    <span key={ev} style={{ fontSize:10, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'1px 6px', borderRadius:4 }}>
                                      {EVENTS.find(e => e.id === ev)?.label ?? ev}
                                    </span>
                                  ))}
                                  {wh.events.length > 3 && <span style={{ fontSize:10, color:'var(--gray-400)' }}>+{wh.events.length-3}</span>}
                                </div>
                              )}
                              {wh.direction !== 'outbound' && (
                                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                  <span style={{ fontSize:10, color:'var(--gray-400)' }}>URL entrante :</span>
                                  <code style={{ fontSize:10, background:'var(--gray-100)', padding:'1px 6px', borderRadius:4, color:'var(--gray-600)', userSelect:'all' }}>{baseUrl}/api/webhooks/inbound/{wh.id}</code>
                                  <button onClick={() => navigator.clipboard.writeText(`${baseUrl}/api/webhooks/inbound/${wh.id}`).then(() => showToast('Copié'))}
                                    style={{ fontSize:10, padding:'1px 6px', borderRadius:4, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer' }}>📋</button>
                                </div>
                              )}
                              {wh.last_triggered_at && (
                                <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>Dernier : {formatDateTime(wh.last_triggered_at)} · {wh.trigger_count} total</div>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                              <button onClick={() => testWebhook(wh)} disabled={testingId===wh.id} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-600)' }}>
                                {testingId===wh.id?'...':'🧪 Test'}
                              </button>
                              <button onClick={() => toggleWebhook(wh.id, wh.is_active)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color: wh.is_active?'#DC2626':'#059669' }}>
                                {wh.is_active?'Désactiver':'Activer'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {connectorTab === 'logs' && (
              <WebhookLogs clinicId={clinicId} />
            )}
          </div>
        )}
      </div>

      {showNewFlow && <NewFlowModal clinicId={clinicId} onClose={() => setShowNewFlow(false)} onCreated={(id: string) => { setShowNewFlow(false); router.push(`/dashboard/flows/${id}`) }} />}
      {showNewWebhook && <NewWebhookModal clinicId={clinicId} onClose={() => setShowNewWebhook(false)} onCreated={() => { setShowNewWebhook(false); load() }} />}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WebhookLogs({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    supabase.from('webhook_logs').select('*, webhook:webhook_integrations(name,provider)').order('created_at', { ascending: false }).limit(40).then(({ data }) => setLogs(data ?? []))
  }, [clinicId])
  return (
    <div className="table-wrap">
      {logs.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucun log webhook</div>
      ) : (
        <table>
          <thead><tr><th>Webhook</th><th>Événement</th><th>Statut</th><th>Date</th></tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontSize:13 }}>{log.webhook?.name ?? '—'}</td>
                <td><span style={{ fontSize:11, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'2px 7px', borderRadius:4, fontWeight:500 }}>{log.event}</span></td>
                <td><span style={{ fontSize:11, fontWeight:600, color: (log.response_status??0) >= 200 && (log.response_status??0) < 300 ? '#059669' : '#DC2626', background: (log.response_status??0) >= 200 && (log.response_status??0) < 300 ? '#F0FDF4' : '#FEF2F2', padding:'2px 7px', borderRadius:99 }}>
                  {log.error ? '✗ Erreur' : `✓ ${log.response_status}`}
                </span></td>
                <td style={{ fontSize:11, color:'var(--gray-500)' }}>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function NewFlowModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name:'', trigger_type:'consultation_created' })
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId, name: form.name, trigger_type: form.trigger_type,
      nodes: [{ id:'trigger', type:'trigger', label:'Déclencheur', icon:'⚡', x:100, y:200, config:{} }],
      edges: [], is_active: false,
    }).select().single()
    setLoading(false)
    if (data) onCreated(data.id)
  }
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:460 }}>
        <div className="modal-header">
          <div className="modal-title">Nouveau workflow</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label className="label">Nom *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Parcours greffe capillaire..." /></div>
            <div>
              <label className="label">Déclencheur *</label>
              <select className="input" value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {Object.entries(TRIGGER_CFG).map(([id, cfg]) => <option key={id} value={id}>{cfg.icon} {cfg.label}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading || !form.name} className="btn-primary">{loading ? 'Création...' : 'Créer et ouvrir →'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewWebhookModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name:'', provider:'custom', direction:'outbound', url:'', secret:'', events:[] as string[] })
  const [loading, setLoading] = useState(false)
  function toggleEvent(id: string) {
    setForm(f => ({ ...f, events: f.events.includes(id) ? f.events.filter(e => e !== id) : [...f.events, id] }))
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await supabase.from('webhook_integrations').insert({ clinic_id: clinicId, ...form, url: form.url || null, secret: form.secret || null })
    setLoading(false); onCreated()
  }
  const pi = PROVIDERS.find(p => p.id === form.provider) ?? PROVIDERS[PROVIDERS.length-1]
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:540 }}>
        <div className="modal-header">
          <div className="modal-title">Nouvelle connexion</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:'60vh', overflowY:'auto' }}>
            <div>
              <label className="label">Application *</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
                {PROVIDERS.map(p => (
                  <div key={p.id} onClick={() => setForm(f => ({ ...f, provider: p.id }))}
                    style={{ padding:'8px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${form.provider===p.id ? p.color : 'var(--gray-200)'}`, background: form.provider===p.id ? p.bg : 'white', textAlign:'center' }}>
                    <div style={{ fontSize:18 }}>{p.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, color: form.provider===p.id ? p.color : 'var(--gray-600)', marginTop:2 }}>{p.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label className="label">Nom *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder={`${pi.label}…`} /></div>
              <div><label className="label">Direction</label>
                <select className="input" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                  <option value="outbound">↗ Sortant</option>
                  <option value="inbound">↙ Entrant</option>
                  <option value="both">↔ Les deux</option>
                </select>
              </div>
            </div>
            {(form.direction === 'outbound' || form.direction === 'both') && (
              <div><label className="label">URL webhook</label><input className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://hooks.zapier.com/..." /></div>
            )}
            <div>
              <label className="label">Événements déclencheurs</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginTop:4 }}>
                {EVENTS.map(ev => (
                  <label key={ev.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 8px', borderRadius:6, cursor:'pointer', background: form.events.includes(ev.id) ? 'var(--blue-light)' : 'var(--gray-50)', border:`1px solid ${form.events.includes(ev.id) ? 'var(--blue-mid)' : 'transparent'}` }}>
                    <input type="checkbox" checked={form.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} style={{ accentColor:'var(--blue)' }} />
                    <span style={{ fontSize:11.5, color: form.events.includes(ev.id) ? 'var(--blue-dark)' : 'var(--gray-700)', fontWeight: form.events.includes(ev.id) ? 500 : 400 }}>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading || !form.name} className="btn-primary">{loading ? 'Création...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
