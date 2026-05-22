'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const STATUS_CFG: Record<string, { label:string; cls:string }> = {
  scheduled: { label:'Planifié',  cls:'badge-gray'   },
  confirmed: { label:'Confirmé',  cls:'badge-blue'   },
  completed: { label:'Terminé',   cls:'badge-green'  },
  cancelled: { label:'Annulé',    cls:''             },
  no_show:   { label:'Absent',    cls:'badge-gray'   },
}
const TYPE_ICON: Record<string,string> = { consultation:'🩺', intervention:'🔬', suivi:'👁️', control:'✅' }

export default function AppointmentsPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'upcoming'|'today'|'all'>('upcoming')
  const [showModal, setShowModal] = useState(false)
  const [clinicId, setClinicId] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])

  useEffect(() => {
    async function init() {
      const { data:{user} } = await supabase.auth.getUser()
      if (!user) return
      const { data:prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      const [{ data:pts }, { data:trts }] = await Promise.all([
        supabase.from('patients').select('id,first_name,last_name').order('last_name'),
        supabase.from('treatments').select('id,name,color').eq('clinic_id', prof.clinic_id),
      ])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
    }
    init()
  }, [])

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase.from('appointments')
      .select('*, patient:patients(first_name,last_name), treatment:treatments(name,color)')
      .order('appointment_date', { ascending: filter !== 'all' })
    if (filter === 'upcoming') q = q.gte('appointment_date', new Date().toISOString())
    if (filter === 'today') {
      const s = new Date(); s.setHours(0,0,0,0)
      const e = new Date(); e.setHours(23,59,59,999)
      q = q.gte('appointment_date', s.toISOString()).lte('appointment_date', e.toISOString())
    }
    const { data } = await q
    setAppointments(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id===id ? {...a, status} : a))
  }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Agenda</div>
          <div className="page-subtitle">{appointments.length} rendez-vous</div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau RDV</button>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div style={{ display:'flex', gap:6, marginBottom:18 }}>
          {(['upcoming','today','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer', background: filter===f ? 'var(--blue)' : 'white', color: filter===f ? 'white' : 'var(--gray-600)', border: filter===f ? 'none' : '1px solid var(--gray-200)' }}>
              {f==='upcoming' ? '📅 À venir' : f==='today' ? "📌 Aujourd'hui" : '🗂️ Tous'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : appointments.length === 0 ? (
          <div className="card" style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)' }}>Aucun rendez-vous</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {appointments.map(a => {
              const sc = STATUS_CFG[a.status] ?? { label:a.status, cls:'badge-gray' }
              return (
                <div key={a.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  {/* Type icon */}
                  <div style={{ width:38, height:38, borderRadius:10, background:'var(--gray-50)', border:'1px solid var(--gray-200)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {TYPE_ICON[a.type] ?? '📅'}
                  </div>

                  {/* Patient + infos */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="avatar" style={{ width:28, height:28, fontSize:10, fontWeight:700, flexShrink:0 }}>
                        {a.patient?.first_name?.[0]}{a.patient?.last_name?.[0]}
                      </div>
                      <Link href={`/dashboard/patients/${a.patient_id}`} style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', textDecoration:'none' }}>
                        {a.patient?.first_name} {a.patient?.last_name}
                      </Link>
                    </div>
                    <div style={{ display:'flex', gap:12, marginTop:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDateTime(a.appointment_date)}</span>
                      {a.treatment && (
                        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--gray-500)' }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', background:a.treatment.color }} />
                          {a.treatment.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span className={`badge ${sc.cls}`} style={a.status==='cancelled' ? { background:'#FEF2F2', color:'#B91C1C' } : {}}>
                      {sc.label}
                    </span>
                    {a.status === 'scheduled' && (
                      <button onClick={() => updateStatus(a.id, 'confirmed')}
                        style={{ padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:11, color:'var(--blue)', fontWeight:500 }}>
                        Confirmer
                      </button>
                    )}
                    {a.status === 'confirmed' && (
                      <button onClick={() => updateStatus(a.id, 'completed')}
                        style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #BBF7D0', background:'#F0FDF4', cursor:'pointer', fontSize:11, color:'#166534', fontWeight:500 }}>
                        Terminé
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && <NewRDVModal clinicId={clinicId} patients={patients} treatments={treatments} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function NewRDVModal({ clinicId, patients, treatments, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ patient_id:'', treatment_id:'', appointment_date:'', type:'consultation', notes:'' })
  const [saving, setSaving] = useState(false)
  const up = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]:e.target.value }))

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('appointments').insert({ ...form, clinic_id:clinicId, treatment_id: form.treatment_id || null })
    setSaving(false); onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau rendez-vous</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label className="label">Patient *</label>
              <select className="input" value={form.patient_id} onChange={up('patient_id')} required>
                <option value="">Choisir…</option>
                {patients.map((p:any) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={up('type')}>
                  <option value="consultation">🩺 Consultation</option>
                  <option value="intervention">🔬 Intervention</option>
                  <option value="suivi">👁️ Suivi</option>
                  <option value="control">✅ Contrôle</option>
                </select>
              </div>
              <div>
                <label className="label">Traitement</label>
                <select className="input" value={form.treatment_id} onChange={up('treatment_id')}>
                  <option value="">—</option>
                  {treatments.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Date & heure *</label>
              <input className="input" type="datetime-local" value={form.appointment_date} onChange={up('appointment_date')} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" value={form.notes} onChange={up('notes')} rows={2} style={{ resize:'none' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement…' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
