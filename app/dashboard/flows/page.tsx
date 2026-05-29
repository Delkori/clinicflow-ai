'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const TRIGGER_CFG: Record<string, {label:string;icon:string;color:string;bg:string}> = {
  consultation_created:   { label:'Consultation créée',    icon:'✦', color:'#1D4ED8', bg:'#EFF6FF' },
  consultation_completed: { label:'Consultation terminée', icon:'✅', color:'#059669', bg:'#F0FDF4' },
  document_signed:        { label:'Document signé',        icon:'✍️', color:'#6B21A8', bg:'#FAF5FF' },
  journey_stage_changed:  { label:'Étape changée',         icon:'🗺️', color:'#D97706', bg:'#FFFBEB' },
  appointment_confirmed:  { label:'RDV confirmé',          icon:'📅', color:'#0891B2', bg:'#ECFEFF' },
  appointment_created:    { label:'RDV créé',              icon:'📅', color:'#0891B2', bg:'#ECFEFF' },
  patient_created:        { label:'Patient créé',          icon:'◎',  color:'#475569', bg:'#F8FAFC' },
  form_completed:         { label:'Formulaire complété',   icon:'📋', color:'#059669', bg:'#F0FDF4' },
  manual:                 { label:'Manuel',                icon:'▶',  color:'#475569', bg:'#F8FAFC' },
  scheduled:              { label:'Planifié',              icon:'⏰', color:'#D97706', bg:'#FFFBEB' },
}

export default function FlowsPage() {
  const supabase = createClient()
  const [flows, setFlows]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew]   = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const { data } = await supabase
      .from('workflow_definitions')
      .select('*, treatment:treatments(name,color)')
      .eq('clinic_id', prof.clinic_id)
      .order('created_at', { ascending: false })
    setFlows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('workflow_definitions').update({ is_active: !current }).eq('id', id)
    setFlows(prev => prev.map(f => f.id === id ? { ...f, is_active: !current } : f))
  }

  async function deleteFlow(id: string) {
    if (!confirm('Supprimer ce workflow ?')) return
    await supabase.from('workflow_definitions').delete().eq('id', id)
    setFlows(prev => prev.filter(f => f.id !== id))
  }

  async function duplicateFlow(flow: any) {
    const { data } = await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId,
      name: `${flow.name} (copie)`,
      description: flow.description,
      trigger_type: flow.trigger_type,
      nodes: flow.nodes,
      edges: flow.edges,
      is_active: false,
    }).select().single()
    if (data) setFlows(prev => [data, ...prev])
  }

  const activeCount = flows.filter(f => f.is_active).length

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Workflows Médicaux</div>
          <div className="page-subtitle">
            {flows.length} workflow{flows.length > 1 ? 's' : ''} ·{' '}
            <span style={{ color:'#059669', fontWeight:600 }}>{activeCount} actif{activeCount > 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>
          + Créer un workflow
        </button>
      </div>

      <div className="page-content">
        {/* Explainer banner */}
        <div style={{ background:'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius:14, padding:'20px 24px', marginBottom:20, display:'flex', gap:20, alignItems:'center' }}>
          <div style={{ fontSize:36, flexShrink:0 }}>⚡</div>
          <div style={{ flex:1 }}>
            <div style={{ color:'white', fontSize:15, fontWeight:700, marginBottom:4 }}>Automatisez votre parcours patient, de A à Z</div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:13, lineHeight:1.6 }}>
              Connectez vos apps et programmez des séquences automatiques : emails, WhatsApp, PDF, signatures, rappels, conditions... Comme n8n, mais conçu pour les médecins.
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <Link href="/dashboard/automations-v2?tab=connectors" style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)', textDecoration:'none', fontWeight:500 }}>
              🔌 Mes apps
            </Link>
            <button onClick={() => setShowNew(true)} style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:'none', background:'#0596DE', color:'white', cursor:'pointer', fontWeight:600 }}>
              + Nouveau workflow
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : flows.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⬡</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-800)', marginBottom:8 }}>Aucun workflow encore</div>
            <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Commencez avec un template ou créez le vôtre</div>
            <button onClick={() => setShowNew(true)} className="btn-primary">Créer mon premier workflow</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {flows.map(flow => {
              const tc = TRIGGER_CFG[flow.trigger_type] ?? TRIGGER_CFG.manual
              const nodeCount = (flow.nodes ?? []).length
              return (
                <div key={flow.id} className="card" style={{ padding:'16px 20px', display:'flex', gap:14, alignItems:'center', opacity: flow.is_active ? 1 : 0.75 }}>
                  {/* Status dot */}
                  <div style={{ width:10, height:10, borderRadius:'50%', background: flow.is_active ? '#10B981' : 'var(--gray-300)', flexShrink:0, boxShadow: flow.is_active ? '0 0 0 3px #D1FAE5' : 'none' }} />

                  {/* Main info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{flow.name}</span>
                      {flow.treatment && (
                        <span style={{ fontSize:11, fontWeight:500, color:flow.treatment.color, background:`${flow.treatment.color}15`, padding:'1px 8px', borderRadius:99, display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:flow.treatment.color }} />
                          {flow.treatment.name}
                        </span>
                      )}
                    </div>
                    {flow.description && <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:8 }}>{flow.description}</div>}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, padding:'2px 8px', borderRadius:99 }}>
                        {tc.icon} {tc.label}
                      </span>
                      <span style={{ fontSize:11, color:'var(--gray-500)', background:'var(--gray-100)', padding:'2px 8px', borderRadius:99 }}>
                        {nodeCount} nœud{nodeCount > 1 ? 's' : ''}
                      </span>
                      {flow.run_count > 0 && (
                        <span style={{ fontSize:11, color:'#059669', background:'#F0FDF4', padding:'2px 8px', borderRadius:99 }}>
                          ✓ {flow.run_count} exécution{flow.run_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {flow.last_run_at && (
                        <span style={{ fontSize:11, color:'var(--gray-400)' }}>Dernier : {formatDateTime(flow.last_run_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                    <Link href={`/dashboard/flows/${flow.id}`} className="btn-secondary" style={{ textDecoration:'none', fontSize:12, padding:'6px 12px' }}>
                      ✏️ Éditer
                    </Link>
                    <button onClick={() => duplicateFlow(flow)} style={{ fontSize:12, padding:'6px 10px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-600)' }}>
                      📋
                    </button>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <span style={{ fontSize:12, color: flow.is_active ? '#059669' : 'var(--gray-400)', fontWeight:500 }}>
                        {flow.is_active ? 'Actif' : 'Inactif'}
                      </span>
                      <span onClick={() => toggleActive(flow.id, flow.is_active)}
                        style={{ position:'relative', display:'inline-block', width:36, height:20, cursor:'pointer' }}>
                        <span style={{ position:'absolute', inset:0, borderRadius:99, background: flow.is_active ? '#10B981' : 'var(--gray-300)', transition:'background .2s' }}>
                          <span style={{ position:'absolute', width:14, height:14, borderRadius:'50%', background:'white', top:3, left: flow.is_active ? 19 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                        </span>
                      </span>
                    </label>
                    <button onClick={() => deleteFlow(flow.id)} style={{ fontSize:12, padding:'6px 8px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)' }}
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

      {showNew && (
        <NewFlowModal
          clinicId={clinicId}
          onClose={() => setShowNew(false)}
          onCreated={(id: string) => { setShowNew(false); window.location.href = `/dashboard/flows/${id}` }}
        />
      )}
    </div>
  )
}

function NewFlowModal({ clinicId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', description: '', trigger_type: 'consultation_created' })
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId,
      name: form.name,
      description: form.description || null,
      trigger_type: form.trigger_type,
      nodes: [{ id:'trigger', type:'trigger', label:'Déclencheur', icon:'⚡', x:100, y:200, config:{} }],
      edges: [],
      is_active: false,
    }).select().single()
    setLoading(false)
    if (data) onCreated(data.id)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <div className="modal-title">Nouveau workflow</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label className="label">Nom du workflow *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Parcours greffe capillaire..." />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ resize:'none' }} placeholder="Ce workflow automatise..." />
            </div>
            <div>
              <label className="label">Déclencheur *</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {Object.entries(TRIGGER_CFG).filter(([k]) => k !== 'manual' && k !== 'scheduled').map(([id, cfg]) => (
                  <label key={id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${form.trigger_type===id ? cfg.color : 'var(--gray-200)'}`, background: form.trigger_type===id ? cfg.bg : 'white', transition:'all .1s' }}>
                    <input type="radio" name="trigger" value={id} checked={form.trigger_type===id} onChange={() => setForm(f => ({ ...f, trigger_type: id }))} style={{ display:'none' }} />
                    <span style={{ fontSize:14 }}>{cfg.icon}</span>
                    <span style={{ fontSize:12, fontWeight: form.trigger_type===id ? 600 : 400, color: form.trigger_type===id ? cfg.color : 'var(--gray-700)' }}>{cfg.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading || !form.name} className="btn-primary">
              {loading ? 'Création...' : 'Créer et ouvrir l\'éditeur →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
