'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8h → 19h
const DAYS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  scheduled:  { color: '#1D4ED8', bg: '#EFF6FF', label: 'Planifié' },
  confirmed:  { color: '#059669', bg: '#F0FDF4', label: 'Confirmé' },
  completed:  { color: '#475569', bg: '#F8FAFC', label: 'Terminé' },
  cancelled:  { color: '#DC2626', bg: '#FEF2F2', label: 'Annulé' },
  no_show:    { color: '#D97706', bg: '#FFFBEB', label: 'Absent' },
}
const TYPE_ICONS: Record<string,string> = { consultation:'🩺', intervention:'🔬', suivi:'👁️', control:'✅' }

function getWeekDates(baseDate: Date) {
  const d = new Date(baseDate)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d)
    dd.setDate(dd.getDate() + i)
    return dd
  })
}

export default function AgendaPage() {
  const supabase = createClient()
  const [viewMode, setViewMode]   = useState<'week'|'day'|'list'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekDates, setWeekDates]  = useState<Date[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [treatments, setTreatments]   = useState<any[]>([])
  const [loading, setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [hoveredAppt, setHoveredAppt] = useState<string | null>(null)

  useEffect(() => {
    setWeekDates(getWeekDates(currentDate))
  }, [currentDate])

  const load = useCallback(async () => {
    if (!weekDates.length) return
    const start = new Date(weekDates[0]); start.setHours(0,0,0,0)
    const end   = new Date(weekDates[6]); end.setHours(23,59,59,999)

    const { data } = await supabase
      .from('appointments')
      .select('*, patient:patients(first_name, last_name, phone), treatment:treatments(name, color)')
      .gte('appointment_date', start.toISOString())
      .lte('appointment_date', end.toISOString())
      .order('appointment_date')
    setAppointments(data ?? [])
    setLoading(false)
  }, [weekDates])

  useEffect(() => {
    load()
    supabase.from('treatments').select('*').then(({ data }) => setTreatments(data ?? []))
  }, [load])

  function prevWeek() { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
  function nextWeek() { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }
  function goToday()  { setCurrentDate(new Date()) }

  const today = new Date()
  const isToday = (d: Date) => d.toDateString() === today.toDateString()

  // Get appointments for a specific day+hour slot
  function getSlotAppointments(date: Date, hour: number) {
    return appointments.filter(a => {
      const ad = new Date(a.appointment_date)
      return ad.toDateString() === date.toDateString() && ad.getHours() === hour
    })
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const monthLabel = currentDate.toLocaleDateString('fr-FR', { month:'long', year:'numeric' })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div>
            <div className="page-title" style={{ textTransform:'capitalize' }}>{monthLabel}</div>
            <div className="page-subtitle">
              {weekDates.length > 0 && `${weekDates[0].toLocaleDateString('fr-FR', { day:'numeric', month:'short' })} – ${weekDates[6].toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}`}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {/* View selector */}
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:'8px', padding:'3px' }}>
            {(['week','day','list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500', background: viewMode === v ? 'white' : 'transparent', color: viewMode === v ? 'var(--gray-900)' : 'var(--gray-500)', boxShadow: viewMode === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition:'all 0.1s' }}>
                {v === 'week' ? '7 jours' : v === 'day' ? 'Jour' : 'Liste'}
              </button>
            ))}
          </div>
          {/* Nav */}
          <button onClick={prevWeek} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:'14px' }}>‹</button>
          <button onClick={goToday} className="btn-secondary" style={{ fontSize:'12px', padding:'5px 12px' }}>Aujourd'hui</button>
          <button onClick={nextWeek} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:'14px' }}>›</button>
          <button onClick={() => { setSelectedSlot(null); setShowModal(true) }} className="btn-primary" style={{ fontSize:'13px' }}>
            + Nouveau RDV
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ flex:1, overflow:'auto', padding:'0 32px 24px' }}>
        {viewMode === 'week' && (
          <div style={{ minWidth:'800px' }}>
            {/* Day headers */}
            <div style={{ display:'grid', gridTemplateColumns:'56px repeat(7, 1fr)', gap:'0', position:'sticky', top:0, zIndex:10, background:'white', borderBottom:'2px solid var(--gray-200)' }}>
              <div />
              {weekDates.map((d, i) => (
                <div key={i} style={{ padding:'10px 8px', textAlign:'center', borderLeft:'1px solid var(--gray-100)' }}>
                  <div style={{ fontSize:'11px', color:'var(--gray-500)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.05em' }}>{DAYS[i]}</div>
                  <div onClick={() => { setCurrentDate(d); setViewMode('day') }}
                    style={{ width:'30px', height:'30px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'4px auto 0', cursor:'pointer', fontSize:'14px', fontWeight: isToday(d) ? '700' : '400', background: isToday(d) ? 'var(--blue)' : 'transparent', color: isToday(d) ? 'white' : 'var(--gray-800)', transition:'all 0.1s' }}
                    onMouseEnter={e => { if (!isToday(d)) e.currentTarget.style.background = 'var(--gray-100)' }}
                    onMouseLeave={e => { if (!isToday(d)) e.currentTarget.style.background = 'transparent' }}>
                    {d.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} style={{ display:'grid', gridTemplateColumns:'56px repeat(7, 1fr)', minHeight:'64px', borderBottom:'1px solid var(--gray-100)' }}>
                <div style={{ padding:'6px 8px 0 0', textAlign:'right', fontSize:'11px', color:'var(--gray-400)', fontWeight:'500', flexShrink:0 }}>{hour}h</div>
                {weekDates.map((d, di) => {
                  const slotAppts = getSlotAppointments(d, hour)
                  return (
                    <div key={di}
                      style={{ borderLeft:'1px solid var(--gray-100)', padding:'2px', position:'relative', minHeight:'64px', background: isToday(d) ? 'rgba(5,150,222,0.02)' : 'transparent', transition:'background 0.1s', cursor:'pointer' }}
                      onClick={() => { setSelectedSlot({ date: d, hour }); setShowModal(true) }}
                      onMouseEnter={e => { if (!slotAppts.length) e.currentTarget.style.background = 'var(--gray-50)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isToday(d) ? 'rgba(5,150,222,0.02)' : 'transparent' }}>
                      {slotAppts.map(a => {
                        const sc = STATUS_CFG[a.status] ?? STATUS_CFG.scheduled
                        return (
                          <div key={a.id}
                            onMouseEnter={() => setHoveredAppt(a.id)}
                            onMouseLeave={() => setHoveredAppt(null)}
                            onClick={e => e.stopPropagation()}
                            style={{ background:sc.bg, borderLeft:`3px solid ${sc.color}`, borderRadius:'6px', padding:'4px 7px', marginBottom:'2px', cursor:'default', position:'relative' }}>
                            <div style={{ fontSize:'11px', fontWeight:'600', color:sc.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {TYPE_ICONS[a.type] ?? '📅'} {a.patient?.first_name} {a.patient?.last_name}
                            </div>
                            <div style={{ fontSize:'10px', color:'var(--gray-500)', display:'flex', gap:'6px', alignItems:'center' }}>
                              {a.treatment && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:a.treatment.color, display:'inline-block', flexShrink:0 }} />}
                              {a.treatment?.name ?? a.type}
                            </div>
                            {/* Hover actions */}
                            {hoveredAppt === a.id && (
                              <div style={{ position:'absolute', top:'100%', left:0, zIndex:20, background:'white', border:'1px solid var(--gray-200)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding:'6px', minWidth:'160px', marginTop:'4px' }}>
                                {Object.entries(STATUS_CFG).map(([s, cfg]) => (
                                  <button key={s} onClick={() => updateStatus(a.id, s)} style={{ display:'block', width:'100%', padding:'6px 10px', textAlign:'left', background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:cfg.color, borderRadius:'5px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = cfg.bg}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                    {cfg.label}
                                  </button>
                                ))}
                                <hr style={{ margin:'4px 0', border:'none', borderTop:'1px solid var(--gray-100)' }} />
                                <Link href={`/dashboard/patients/${a.patient_id}`} style={{ display:'block', padding:'6px 10px', fontSize:'12px', color:'var(--blue)', textDecoration:'none' }}>Voir la fiche →</Link>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'day' && (
          <div style={{ minWidth:'400px', maxWidth:'600px', margin:'0 auto' }}>
            <div style={{ padding:'10px 0 14px', display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: isToday(currentDate) ? 'var(--blue)' : 'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color: isToday(currentDate) ? 'white' : 'var(--gray-900)' }}>
                {currentDate.getDate()}
              </div>
              <div>
                <div style={{ fontSize:'15px', fontWeight:'600', color:'var(--gray-900)', textTransform:'capitalize' }}>{currentDate.toLocaleDateString('fr-FR', { weekday:'long' })}</div>
                <div style={{ fontSize:'12px', color:'var(--gray-500)' }}>{currentDate.toLocaleDateString('fr-FR', { day:'numeric', month:'long' })}</div>
              </div>
            </div>
            {HOURS.map(hour => {
              const slotAppts = getSlotAppointments(currentDate, hour)
              return (
                <div key={hour} style={{ display:'flex', gap:'12px', minHeight:'56px', borderBottom:'1px solid var(--gray-100)' }}>
                  <div style={{ width:'40px', flexShrink:0, fontSize:'12px', color:'var(--gray-400)', paddingTop:'8px', textAlign:'right' }}>{hour}h</div>
                  <div style={{ flex:1, padding:'4px 0 4px', cursor:'pointer' }}
                    onClick={() => { setSelectedSlot({ date: currentDate, hour }); setShowModal(true) }}>
                    {slotAppts.map(a => {
                      const sc = STATUS_CFG[a.status] ?? STATUS_CFG.scheduled
                      return (
                        <div key={a.id} style={{ background:sc.bg, borderLeft:`3px solid ${sc.color}`, borderRadius:'8px', padding:'8px 12px', marginBottom:'4px' }}>
                          <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--gray-900)' }}>{TYPE_ICONS[a.type]} {a.patient?.first_name} {a.patient?.last_name}</div>
                          <div style={{ fontSize:'12px', color:'var(--gray-500)', marginTop:'2px', display:'flex', gap:'10px' }}>
                            {a.treatment?.name && <span>{a.treatment.name}</span>}
                            {a.patient?.phone && <span>📱 {a.patient.phone}</span>}
                            <span className={`badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'cancelled' ? '' : 'badge-gray'}`} style={{ fontSize:'10px', ...(a.status==='cancelled'?{background:'#FEF2F2',color:'#B91C1C'}:{}) }}>{sc.label}</span>
                          </div>
                        </div>
                      )
                    })}
                    {slotAppts.length === 0 && <div style={{ height:'100%', minHeight:'44px' }} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'list' && (
          <div>
            {loading ? (
              <div style={{ padding:'60px', textAlign:'center' }}><div style={{ width:'28px', height:'28px', border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
            ) : appointments.length === 0 ? (
              <div style={{ padding:'60px', textAlign:'center', color:'var(--gray-400)' }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>◫</div>
                <div>Aucun rendez-vous cette semaine</div>
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop:'8px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date & heure</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Traitement</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(a => {
                      const sc = STATUS_CFG[a.status] ?? STATUS_CFG.scheduled
                      const ad = new Date(a.appointment_date)
                      return (
                        <tr key={a.id}>
                          <td>
                            <div style={{ fontSize:'13px', fontWeight:'500' }}>{ad.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })}</div>
                            <div style={{ fontSize:'12px', color:'var(--gray-500)' }}>{ad.getHours()}h{String(ad.getMinutes()).padStart(2,'0')}</div>
                          </td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div className="avatar" style={{ width:'28px', height:'28px', fontSize:'10px' }}>{a.patient?.first_name?.[0]}{a.patient?.last_name?.[0]}</div>
                              <div>
                                <div style={{ fontSize:'13px', fontWeight:'500' }}>{a.patient?.first_name} {a.patient?.last_name}</div>
                                {a.patient?.phone && <div style={{ fontSize:'11px', color:'var(--gray-500)' }}>{a.patient.phone}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize:'13px' }}>{TYPE_ICONS[a.type]} {a.type}</td>
                          <td>
                            {a.treatment && (
                              <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px' }}>
                                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:a.treatment.color, flexShrink:0 }} />
                                {a.treatment.name}
                              </span>
                            )}
                          </td>
                          <td>
                            <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                              style={{ fontSize:'11px', padding:'3px 6px', borderRadius:'6px', border:`1px solid ${sc.color}40`, background:sc.bg, color:sc.color, cursor:'pointer', fontWeight:'500' }}>
                              {Object.entries(STATUS_CFG).map(([s, c]) => <option key={s} value={s}>{c.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <Link href={`/dashboard/patients/${a.patient_id}`} style={{ color:'var(--blue)', fontSize:'12px', fontWeight:'500', textDecoration:'none' }}>Voir →</Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NewAppointmentModal
          slot={selectedSlot}
          treatments={treatments}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function NewAppointmentModal({ slot, treatments, onClose, onCreated }: any) {
  const supabase = createClient()
  const [patients, setPatients]  = useState<any[]>([])
  const [clinicId, setClinicId]  = useState('')
  const defaultDate = slot
    ? (() => { const d = new Date(slot.date); d.setHours(slot.hour, 0, 0, 0); return d.toISOString().slice(0,16) })()
    : new Date().toISOString().slice(0,16)

  const [form, setForm] = useState({ patient_id:'', treatment_id:'', appointment_date: defaultDate, type:'consultation', notes:'' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (profile) setClinicId(profile.clinic_id)
      const { data: pts } = await supabase.from('patients').select('id, first_name, last_name').order('last_name')
      setPatients(pts ?? [])
    }
    load()
  }, [])

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('appointments').insert({
      ...form, clinic_id: clinicId,
      treatment_id: form.treatment_id || null,
      status: 'scheduled',
    })
    setLoading(false)
    onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau rendez-vous</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div>
              <label className="label">Patient *</label>
              <select className="input" value={form.patient_id} onChange={update('patient_id')} required>
                <option value="">Choisir un patient...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={update('type')}>
                  <option value="consultation">🩺 Consultation</option>
                  <option value="intervention">🔬 Intervention</option>
                  <option value="suivi">👁️ Suivi</option>
                  <option value="control">✅ Contrôle</option>
                </select>
              </div>
              <div>
                <label className="label">Traitement</label>
                <select className="input" value={form.treatment_id} onChange={update('treatment_id')}>
                  <option value="">—</option>
                  {treatments.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Date & heure *</label>
              <input className="input" type="datetime-local" value={form.appointment_date} onChange={update('appointment_date')} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" value={form.notes} onChange={update('notes')} rows={2} style={{ resize:'none' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Enregistrement...' : 'Créer le RDV'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
