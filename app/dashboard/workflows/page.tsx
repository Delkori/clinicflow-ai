'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timingLabel } from '@/lib/utils'

const TYPE_CFG: Record<string,{icon:string;label:string;color:string;bg:string;border:string}> = {
  email:    { icon:'📧', label:'Email',    color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
  whatsapp: { icon:'💬', label:'WhatsApp', color:'#166534', bg:'#F0FDF4', border:'#BBF7D0' },
  docusign: { icon:'✍️', label:'DocuSign', color:'#6B21A8', bg:'#FAF5FF', border:'#DDD6FE' },
  document: { icon:'📄', label:'Document', color:'#475569', bg:'#F8FAFC', border:'#E2E8F0' },
  sms:      { icon:'📱', label:'SMS',      color:'#92400E', bg:'#FFFBEB', border:'#FDE68A' },
}

export default function WorkflowsPage() {
  const supabase = createClient()
  const [workflows, setWorkflows]     = useState<any[]>([])
  const [treatments, setTreatments]   = useState<any[]>([])
  const [selected, setSelected]       = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [clinicId, setClinicId]       = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [showStep, setShowStep]       = useState(false)

  const load = useCallback(async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) return
    const { data:prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data:wfs }, { data:trts }] = await Promise.all([
      supabase.from('workflows').select('*, treatment:treatments(name,color), steps:workflow_steps(*)').eq('clinic_id', prof.clinic_id).order('created_at'),
      supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id),
    ])
    const sorted = (wfs ?? []).map((w:any) => ({ ...w, steps:(w.steps??[]).sort((a:any,b:any)=>a.step_order-b.step_order) }))
    setWorkflows(sorted)
    setTreatments(trts ?? [])
    if (sorted.length && !selected) setSelected(sorted[0])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteStep(sid:string) {
    await supabase.from('workflow_steps').delete().eq('id', sid)
    await load()
    setSelected((prev:any) => workflows.find(w => w.id === prev?.id) ?? prev)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* ── Left panel ── */}
      <aside style={{ width:260, borderRight:'1px solid var(--gray-200)', background:'white', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Workflows</span>
          <button onClick={() => setShowNew(true)} style={{ width:28, height:28, borderRadius:8, background:'var(--blue)', border:'none', cursor:'pointer', color:'white', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>+</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {workflows.length === 0 ? (
            <div style={{ padding:'24px 12px', textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucun workflow.<br />Créez-en un ↑</div>
          ) : workflows.map(w => (
            <button key={w.id} onClick={() => setSelected(w)}
              style={{ width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8, border: selected?.id===w.id ? '1px solid var(--blue-mid)' : '1px solid transparent', background: selected?.id===w.id ? 'var(--blue-light)' : 'transparent', cursor:'pointer', marginBottom:2, transition:'all .1s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:w.treatment?.color ?? 'var(--blue)', flexShrink:0 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                  <div style={{ fontSize:11, color:'var(--gray-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.treatment?.name}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <span style={{ fontSize:11, color:'var(--gray-500)' }}>{w.steps?.length ?? 0} étape{w.steps?.length!==1?'s':''}</span>
                <span style={{ fontSize:11, background: w.is_active?'#DCFCE7':'var(--gray-100)', color: w.is_active?'#166534':'var(--gray-500)', borderRadius:99, padding:'0 6px' }}>{w.is_active?'Actif':'Inactif'}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div style={{ flex:1, overflow:'auto' }}>
        {!selected ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
            <div style={{ textAlign:'center', color:'var(--gray-400)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>⬡</div>
              <div style={{ fontSize:15, fontWeight:500 }}>Sélectionnez un workflow</div>
              <button onClick={() => setShowNew(true)} className="btn-primary" style={{ marginTop:16 }}>+ Créer un workflow</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div className="page-title">{selected.name}</div>
                <div className="page-subtitle">Traitement : {selected.treatment?.name}</div>
              </div>
              <button onClick={() => setShowStep(true)} className="btn-primary">+ Ajouter une étape</button>
            </div>

            <div className="page-content">
              {(!selected.steps || selected.steps.length === 0) ? (
                <div className="card" style={{ padding:'52px', textAlign:'center' }}>
                  <div style={{ fontSize:38, marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucune étape</div>
                  <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Ajoutez des étapes pour automatiser le parcours patient</div>
                  <button onClick={() => setShowStep(true)} className="btn-primary">+ Première étape</button>
                </div>
              ) : (
                <div style={{ position:'relative', paddingLeft:24 }}>
                  <div style={{ position:'absolute', left:15, top:16, bottom:16, width:2, background:'var(--gray-100)', borderRadius:1 }} />
                  {selected.steps.map((step:any, i:number) => {
                    const tc = TYPE_CFG[step.type] ?? TYPE_CFG.document
                    return (
                      <div key={step.id} style={{ display:'flex', gap:16, marginBottom:14 }}>
                        {/* Icon bubble */}
                        <div style={{ width:32, height:32, borderRadius:'50%', background:tc.bg, border:`1.5px solid ${tc.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, zIndex:1 }}>
                          {tc.icon}
                        </div>

                        {/* Card */}
                        <div className="card" style={{ flex:1, padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                                <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, border:`1px solid ${tc.border}`, borderRadius:99, padding:'1px 8px' }}>{tc.label}</span>
                                <span style={{ fontSize:11, background:'var(--gray-100)', color:'var(--gray-600)', borderRadius:99, padding:'1px 8px' }}>
                                  {timingLabel(step.timing_days, step.timing_reference)}
                                </span>
                                {!step.is_active && <span style={{ fontSize:11, background:'#FEF2F2', color:'#B91C1C', borderRadius:99, padding:'1px 8px' }}>Inactif</span>}
                              </div>
                              <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{step.template_name ?? 'Sans nom'}</div>
                              {step.template_subject && <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>Sujet : {step.template_subject}</div>}
                              {step.template_body && <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:5, background:'var(--gray-50)', borderRadius:6, padding:'6px 9px', borderLeft:`2px solid ${tc.border}`, lineHeight:1.55 }}>{step.template_body}</div>}
                            </div>
                            <button onClick={() => deleteStep(step.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-300)', fontSize:14, padding:'2px', flexShrink:0 }}
                              onMouseEnter={e => e.currentTarget.style.color='#DC2626'}
                              onMouseLeave={e => e.currentTarget.style.color='var(--gray-300)'}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNew && <NewWorkflowModal treatments={treatments} clinicId={clinicId} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
      {showStep && selected && <NewStepModal workflowId={selected.id} stepCount={selected.steps?.length ?? 0} onClose={() => setShowStep(false)} onCreated={() => { setShowStep(false); load() }} />}
    </div>
  )
}

function NewWorkflowModal({ treatments, clinicId, onClose, onCreated }:any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name:'', treatment_id:'' })
  const [saving, setSaving] = useState(false)
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('workflows').insert({ ...form, clinic_id:clinicId })
    setSaving(false); onCreated()
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Nouveau workflow</div><button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label className="label">Nom *</label><input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required placeholder="Parcours greffe complet…" /></div>
            <div><label className="label">Traitement *</label>
              <select className="input" value={form.treatment_id} onChange={e => setForm(f=>({...f,treatment_id:e.target.value}))} required>
                <option value="">Choisir…</option>
                {treatments.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer"><button type="button" onClick={onClose} className="btn-secondary">Annuler</button><button type="submit" disabled={saving} className="btn-primary">{saving?'…':'Créer'}</button></div>
        </form>
      </div>
    </div>
  )
}

function NewStepModal({ workflowId, stepCount, onClose, onCreated }:any) {
  const supabase = createClient()
  const [form, setForm] = useState({ type:'email', timing_days:0, timing_reference:'consultation', template_name:'', template_subject:'', template_body:'' })
  const [saving, setSaving] = useState(false)
  const up = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[k]:k==='timing_days'?parseInt(e.target.value)||0:e.target.value}))

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('workflow_steps').insert({ ...form, workflow_id:workflowId, step_order:stepCount+1 })
    setSaving(false); onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-header"><div className="modal-title">Nouvelle étape</div><button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:'65vh', overflowY:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="label">Type *</label>
                <select className="input" value={form.type} onChange={up('type')}>
                  <option value="email">📧 Email</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="document">📄 Document</option>
                  <option value="docusign">✍️ DocuSign</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
              <div><label className="label">Référence</label>
                <select className="input" value={form.timing_reference} onChange={up('timing_reference')}>
                  <option value="consultation">Consultation</option>
                  <option value="intervention">Intervention</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Timing (jours — négatif = avant)</label>
              <input className="input" type="number" value={form.timing_days} onChange={up('timing_days')} />
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                {form.timing_days===0 ? 'Le jour même' : form.timing_days>0 ? `J+${form.timing_days}` : `J${form.timing_days}`} après {form.timing_reference==='consultation'?'la consultation':"l'intervention"}
              </div>
            </div>
            <div><label className="label">Nom du template *</label><input className="input" value={form.template_name} onChange={up('template_name')} required placeholder="rappel_pre_op, j1_post_op…" /></div>
            {form.type==='email' && <div><label className="label">Sujet email</label><input className="input" value={form.template_subject} onChange={up('template_subject')} /></div>}
            <div>
              <label className="label">Corps du message</label>
              <textarea className="input" value={form.template_body} onChange={up('template_body')} rows={4} style={{ resize:'vertical' }} placeholder={`Bonjour {{patient_name}},\n\n…`} />
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>Variables : <code style={{ background:'var(--gray-100)', padding:'1px 4px', borderRadius:3 }}>{'{{patient_name}}'}</code> <code style={{ background:'var(--gray-100)', padding:'1px 4px', borderRadius:3 }}>{'{{clinic_name}}'}</code></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" onClick={onClose} className="btn-secondary">Annuler</button><button type="submit" disabled={saving} className="btn-primary">{saving?'…':"Ajouter l'étape"}</button></div>
        </form>
      </div>
    </div>
  )
}
