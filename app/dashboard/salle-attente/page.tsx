'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS_ATTENTE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  arrive:      { label: 'Arrivé',           color: '#059669', bg: '#ECFDF5', icon: '✓' },
  en_salle:    { label: 'En salle',         color: '#0891B2', bg: '#ECFEFF', icon: '🩺' },
  en_attente:  { label: 'En attente',       color: '#D97706', bg: '#FFFBEB', icon: '⏳' },
  traite:      { label: 'Traité',           color: '#6B7280', bg: '#F3F4F6', icon: '✅' },
  absent:      { label: 'Absent',           color: '#DC2626', bg: '#FEF2F2', icon: '✗' },
}

export default function SalleAttentePage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editingNote, setEditingNote] = useState<string|null>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)

    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

    const { data } = await supabase.from('appointments')
      .select('*, patient:patients(id, first_name, last_name, phone, email, date_of_birth), treatment:treatments(name, color)')
      .eq('clinic_id', prof.clinic_id)
      .gte('appointment_date', start)
      .lte('appointment_date', end)
      .order('appointment_date')

    setAppointments(data ?? [])
    // Init statuses
    const init: Record<string, string> = {}
    ;(data ?? []).forEach(a => { init[a.id] = a.status === 'confirmed' ? 'en_attente' : a.status })
    setStatuses(init)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function updateStatus(id: string, status: string) {
    setStatuses(prev => ({ ...prev, [id]: status }))
    supabase.from('appointments').update({ status }).eq('id', id)
  }

  const now = time
  const heureActuelle = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const getRetard = (appointment_date: string) => {
    const apptTime = new Date(appointment_date)
    const diff = Math.round((now.getTime() - apptTime.getTime()) / 60000)
    return diff
  }

  const stats = {
    total: appointments.length,
    arrives: Object.values(statuses).filter(s => s === 'arrive').length,
    en_salle: Object.values(statuses).filter(s => s === 'en_salle').length,
    traites: Object.values(statuses).filter(s => s === 'traite').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div className="page-title">Salle d'attente</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })} · {heureActuelle}
            <span style={{ marginLeft:8, display:'inline-flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', display:'inline-block', animation:'pulse 2s infinite' }} />
              En direct
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} className="btn-secondary" style={{ fontSize:13 }}>🔄 Actualiser</button>
          <Link href="/dashboard/agenda" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>📅 Agenda complet</Link>
        </div>
      </div>

      <div className="page-content" style={{ flex:1, overflow:'auto' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'RDV aujourd\'hui', value: stats.total, icon:'📅', color:'var(--gray-700)' },
            { label:'Arrivés', value: stats.arrives, icon:'✓', color:'#059669' },
            { label:'En salle', value: stats.en_salle, icon:'🩺', color:'#0891B2' },
            { label:'Traités', value: stats.traites, icon:'✅', color:'#6B7280' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : appointments.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🌅</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucun rendez-vous aujourd'hui</div>
            <div style={{ fontSize:13, color:'var(--gray-500)' }}>Votre agenda est vide pour cette journée</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {appointments.map(appt => {
              const status = statuses[appt.id] ?? 'en_attente'
              const sc = STATUS_ATTENTE[status] ?? STATUS_ATTENTE.en_attente
              const retard = getRetard(appt.appointment_date)
              const apptTime = new Date(appt.appointment_date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
              const isLate = retard > 10 && status === 'en_attente'
              const age = appt.patient?.date_of_birth
                ? Math.floor((Date.now() - new Date(appt.patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
                : null

              return (
                <div key={appt.id} className="card" style={{ padding:'14px 18px', display:'flex', gap:14, alignItems:'flex-start', borderLeft:`4px solid ${appt.treatment?.color ?? 'var(--blue)'}`, transition:'all .15s' }}>
                  {/* Heure */}
                  <div style={{ flexShrink:0, textAlign:'center', minWidth:50 }}>
                    <div style={{ fontSize:16, fontWeight:800, color:'var(--gray-900)', fontVariantNumeric:'tabular-nums' }}>{apptTime}</div>
                    {isLate && <div style={{ fontSize:9, color:'#DC2626', fontWeight:700, marginTop:2 }}>+{retard}min</div>}
                  </div>

                  {/* Patient info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div className="avatar" style={{ width:32, height:32, fontSize:11 }}>
                        {appt.patient?.first_name?.[0]}{appt.patient?.last_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>
                          {appt.patient?.first_name} {appt.patient?.last_name}
                          {age && <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:6 }}>{age} ans</span>}
                        </div>
                        <div style={{ fontSize:12, color:'var(--gray-500)', display:'flex', gap:8 }}>
                          {appt.treatment && <span style={{ color: appt.treatment.color, fontWeight:500 }}>{appt.treatment.name}</span>}
                          {appt.patient?.phone && <span>{appt.patient.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Note */}
                    {editingNote === appt.id ? (
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        <input className="input" value={notes[appt.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [appt.id]: e.target.value }))}
                          placeholder="Note pour ce patient..." style={{ fontSize:12, flex:1 }} autoFocus
                          onKeyDown={e => e.key === 'Enter' && setEditingNote(null)} />
                        <button onClick={() => setEditingNote(null)} style={{ fontSize:11, padding:'0 10px', borderRadius:6, border:'none', background:'var(--green)', color:'white', cursor:'pointer', fontWeight:600 }}>✓</button>
                      </div>
                    ) : notes[appt.id] ? (
                      <div style={{ fontSize:12, color:'var(--gray-600)', marginTop:5, display:'flex', gap:5, alignItems:'center', cursor:'pointer' }} onClick={() => setEditingNote(appt.id)}>
                        <span style={{ color:'#D97706' }}>📝</span> {notes[appt.id]}
                      </div>
                    ) : (
                      <button onClick={() => setEditingNote(appt.id)} style={{ fontSize:11, color:'var(--gray-400)', background:'none', border:'none', cursor:'pointer', marginTop:4, padding:0 }}>
                        + Ajouter une note
                      </button>
                    )}
                  </div>

                  {/* Status buttons */}
                  <div style={{ display:'flex', gap:5, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:240 }}>
                    {Object.entries(STATUS_ATTENTE).map(([key, cfg]) => (
                      <button key={key} onClick={() => updateStatus(appt.id, key)}
                        style={{ fontSize:11, padding:'4px 9px', borderRadius:20, cursor:'pointer', fontWeight: status===key ? 700 : 400, border:`1.5px solid ${status===key ? cfg.color : 'var(--gray-200)'}`, background: status===key ? cfg.bg : 'white', color: status===key ? cfg.color : 'var(--gray-500)', transition:'all .1s' }}>
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick actions */}
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    <Link href={`/dashboard/patients/${appt.patient?.id}`}
                      style={{ fontSize:11, padding:'5px 9px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', color:'var(--blue)', textDecoration:'none', fontWeight:500, whiteSpace:'nowrap' }}>
                      Dossier →
                    </Link>
                    <Link href={`/dashboard/consultations/new?patient_id=${appt.patient?.id}`}
                      style={{ fontSize:11, padding:'5px 9px', borderRadius:6, border:'none', background:'var(--blue)', color:'white', textDecoration:'none', fontWeight:600, whiteSpace:'nowrap' }}>
                      + Consultation
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
