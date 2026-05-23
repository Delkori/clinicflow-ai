'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timingLabel } from '@/lib/utils'

const TYPE_CFG: Record<string,{icon:string;label:string;color:string;bg:string}> = {
  email:    { icon:'📧', label:'Email',    color:'#1D4ED8', bg:'#EFF6FF' },
  whatsapp: { icon:'💬', label:'WhatsApp', color:'#166534', bg:'#F0FDF4' },
  docusign: { icon:'✍️', label:'DocuSign', color:'#6B21A8', bg:'#FAF5FF' },
  document: { icon:'📄', label:'Document', color:'#475569', bg:'#F8FAFC' },
  sms:      { icon:'📱', label:'SMS',      color:'#92400E', bg:'#FFFBEB' },
}

export default function WorkflowsPage() {
  const supabase = createClient()
  const [workflows, setWorkflows]   = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [selected, setSelected]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [clinicId, setClinicId]     = useState('')
  const [showNew, setShowNew]       = useState(false)
  const [showStep, setShowStep]     = useState(false)

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
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left panel */}
      <aside style={{ width:260, borderRight:'1px solid var(--gray-200)', background:'white', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Workflows</div>
            <div style={{ fontSize:11, color:'var(--gray-500)', marginTop:1 }}>{workflows.length} workflow{workflows.length > 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setShowNew(true)} style={{ width:28, height:28, borderRadius:8, background:'var(--blue)', border:'none', cursor:'pointer', color:'white', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          {workflows.length === 0 ? (
            <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>⬡</div>
              Aucun workflow.<br />Créez-en un ↑
            </div>
          ) : workflows.map(w => (
            <button key={w.id} onClick={() => setSelected(w)} style={{
              width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8, cursor:'pointer', marginBottom:2, transition:'all .1s',
              border: selected?.id===w.id ? '1px solid var(--blue-mid)' : '1px solid transparent',
              background: selected?.id===w.id ? 'var(--blue-light)' : 'transparent',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:w.treatment?.color ?? 'var(--blue)', flexShrink:0 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                  <div style={{ fontSize:11, color:'var(--gray-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.treatment?.name}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={{ fontSize:11, color:'var(--gray-500)' }}>{w.steps?.length ?? 0} étape{w.steps?.length!==1?'s':''}</span>
                <span style={{ fontSize:11, background: w.is_active?'#DCFCE7':'var(--gray-100)', color: w.is_active?'#166534':'var(--gray-500)', borderRadius:99, padding:'0 6px', fontWeight:500 }}>
                  {w.is_active?'Actif':'Inactif'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        {!selected ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'var(--gray-400)' }}>
            <span style={{ fontSize:48 }}>⬡</span>
            <div style={{ fontSize:15, fontWeight:500 }}>Sélectionnez un workflow</div>
            <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Créer un workflow</button>
          </div>
        ) : (
          <>
            {/* Workflow header */}
            <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:selected.treatment?.color ?? 'var(--blue)' }} />
                  <div className="page-title">{selected.name}</div>
                </div>
                <div className="page-subtitle">{selected.treatment?.name} · {selected.steps?.length ?? 0} étape{selected.steps?.length!==1?'s':''}</div>
              </div>
              <button onClick={() => setShowStep(true)} className="btn-primary" style={{ fontSize:13 }}>+ Ajouter une étape</button>
            </div>

            {/* Steps */}
            <div className="page-content" style={{ flex:1 }}>
              {!selected.steps?.length ? (
                <div style={{ border:'2px dashed var(--gray-200)', borderRadius:16, padding:'48px 40px', textAlign:'center' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucune étape</div>
                  <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Ajoutez des étapes pour définir le parcours automatisé du patient</div>
                  <button onClick={() => setShowStep(true)} className="btn-primary">+ Ajouter la première étape</button>
                </div>
              ) : (
                <div style={{ position:'relative', paddingLeft:20 }}>
                  <div style={{ position:'absolute', left:27, top:20, bottom:20, width:2, background:'var(--gray-200)', borderRadius:99 }} />
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {selected.steps.map((step:any, i:number) => {
                      const tc = TYPE_CFG[step.type] ?? TYPE_CFG.document
                      return (
                        <div key={step.id} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                          {/* Icon bubble */}
                          <div style={{ width:36, height:36, borderRadius:'50%', background:tc.bg, border:`2px solid ${tc.bg}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0, zIndex:1, position:'relative' }}>
                            {tc.icon}
                          </div>
                          {/* Content card */}
                          <div className="card" style={{ flex:1, padding:'14px 18px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                                  <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, padding:'2px 8px', borderRadius:99 }}>{tc.label}</span>
                                  <span style={{ fontSize:11, color:'var(--gray-500)', background:'var(--gray-100)', padding:'2px 8px', borderRadius:99 }}>
                                    {timingLabel(step.timing_days, step.timing_reference)}
                                  </span>
                                  {!step.is_active && <span style={{ fontSize:11, color:'#DC2626', background:'#FEF2F2', padding:'2px 8px', borderRadius:99 }}>Inactif</span>}
                                </div>
                                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:2 }}>{step.template_name ?? 'Sans nom'}</div>
                                {step.template_subject && <div style={{ fontSize:12, color:'var(--gray-500)' }}>Sujet : {step.template_subject}</div>}
                                {step.template_body && <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:4, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{step.template_body}</div>}
                              </div>
                              <button onClick={() => deleteStep(step.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-300)', fontSize:14, padding:4, flexShrink:0, marginLeft:8, transition:'color .1s' }}
                                onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
                                onMouseLeave={e => e.currentTarget.style.color='var(--gray-300)'}>
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showNew && <NewWorkflowModal treatments={treatments} clinicId={clinicId} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
      {showStep && selected && <NewStepModal workflowId={selected.id} stepCount={selected.steps?.length ?? 0} onClose={() => setShowStep(false)} onCreated={() => { setShowStep(false); load() }} />}
    </div>
  )
}

function NewWorkflowModal({ treatments, clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name:'', treatment_id:'' })
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await supabase.from('workflows').insert({ ...form, clinic_id: clinicId })
    setLoading(false); onCreated()
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau workflow</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label className="label">Nom du workflow *</label>
              <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required placeholder="Parcours greffe complet..." />
            </div>
            <div>
              <label className="label">Traitement associé *</label>
              <select className="input" value={form.treatment_id} onChange={e => setForm(f=>({...f,treatment_id:e.target.value}))} required>
                <option value="">Choisir...</option>
                {treatments.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
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

function NewStepModal({ workflowId, stepCount, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ type:'email', timing_days:0, timing_reference:'consultation', template_name:'', template_subject:'', template_body:'' })
  const [loading, setLoading] = useState(false)
  const up = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: k==='timing_days' ? (parseInt(e.target.value)||0) : e.target.value }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await supabase.from('workflow_steps').insert({ ...form, workflow_id: workflowId, step_order: stepCount+1 })
    setLoading(false); onCreated()
  }
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-header">
          <div className="modal-title">Nouvelle étape</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:13, maxHeight:'60vh', overflowY:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="label">Type d'action *</label>
                <select className="input" value={form.type} onChange={up('type')}>
                  <option value="email">📧 Email</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="document">📄 Document</option>
                  <option value="docusign">✍️ DocuSign</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
              <div>
                <label className="label">Référence timing</label>
                <select className="input" value={form.timing_reference} onChange={up('timing_reference')}>
                  <option value="consultation">Consultation</option>
                  <option value="intervention">Intervention</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Timing (jours) — négatif = avant</label>
              <input className="input" type="number" value={form.timing_days} onChange={up('timing_days')} />
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                {form.timing_days===0 ? 'Le jour même' : form.timing_days>0 ? `J+${form.timing_days}` : `J${form.timing_days}`} après {form.timing_reference==='consultation'?'la consultation':"l'intervention"}
              </div>
            </div>
            <div>
              <label className="label">Nom du template *</label>
              <input className="input" value={form.template_name} onChange={up('template_name')} required placeholder="instructions_post_op, rappel_rdv..." />
            </div>
            {form.type === 'email' && (
              <div>
                <label className="label">Sujet de l'email</label>
                <input className="input" value={form.template_subject} onChange={up('template_subject')} placeholder="Votre rendez-vous demain — {{clinic_name}}" />
              </div>
            )}
            <div>
              <label className="label">Corps du message</label>
              <textarea className="input" value={form.template_body} onChange={up('template_body')} rows={4} style={{ resize:'vertical' }} placeholder="Bonjour {{patient_name}}, ..." />
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>Variables : {`{{patient_name}}`} {`{{first_name}}`} {`{{clinic_name}}`}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Ajout...' : 'Ajouter l\'étape'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
