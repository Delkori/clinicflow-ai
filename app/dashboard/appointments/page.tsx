'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  scheduled:  { label: 'Planifié',   bg: 'bg-amber-50',   color: 'text-amber-700',  dot: 'bg-amber-400'  },
  confirmed:  { label: 'Confirmé',   bg: 'bg-blue-50',    color: 'text-blue-700',   dot: 'bg-blue-400'   },
  completed:  { label: 'Terminé',    bg: 'bg-green-50',   color: 'text-green-700',  dot: 'bg-green-400'  },
  cancelled:  { label: 'Annulé',     bg: 'bg-red-50',     color: 'text-red-600',    dot: 'bg-red-400'    },
  no_show:    { label: 'Absent',     bg: 'bg-gray-100',   color: 'text-gray-500',   dot: 'bg-gray-400'   },
}

export default function AppointmentsPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'today'|'upcoming'>('upcoming')
  const [showModal, setShowModal] = useState(false)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', treatment_id: '', appointment_date: '', notes: '', status: 'scheduled' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      const [{ data: appts }, { data: pts }, { data: trts }] = await Promise.all([
        supabase.from('appointments').select('*, patient:patients(first_name,last_name,phone), treatment:treatments(name,color)').eq('clinic_id', prof.clinic_id).order('appointment_date', { ascending: false }),
        supabase.from('patients').select('id,first_name,last_name').eq('clinic_id', prof.clinic_id).order('last_name'),
        supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id),
      ])
      setAppointments(appts ?? [])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
      setLoading(false)
    }
    init()
  }, [supabase])

  const now = new Date()
  const todayStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filtered = appointments.filter(a => {
    if (filter === 'all') return true
    const d = new Date(a.appointment_date)
    if (filter === 'today') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) === todayStr
    if (filter === 'upcoming') return d >= now
    return true
  })

  async function createAppointment() {
    if (!form.patient_id || !form.appointment_date || !clinicId) return
    setSaving(true)
    const { data } = await supabase.from('appointments').insert({
      ...form, clinic_id: clinicId, treatment_id: form.treatment_id || null,
    }).select('*, patient:patients(first_name,last_name,phone), treatment:treatments(name,color)').single()
    if (data) setAppointments(prev => [data, ...prev])
    setSaving(false)
    setShowModal(false)
    setForm({ patient_id: '', treatment_id: '', appointment_date: '', notes: '', status: 'scheduled' })
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} rendez-vous</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau RDV</button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {(['upcoming','today','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'upcoming' ? '📅 À venir' : f === 'today' ? "☀️ Aujourd'hui" : '📋 Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-semibold text-gray-900 mb-1">Aucun rendez-vous</p>
          <p className="text-sm text-gray-400 mb-5">Planifiez le premier rendez-vous</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau RDV</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const s = STATUS[a.status] ?? STATUS.scheduled
            const isToday = new Date(a.appointment_date).toLocaleDateString('fr-FR', { day:'2-digit',month:'2-digit',year:'numeric' }) === todayStr
            return (
              <div key={a.id} className={`card p-4 flex items-center gap-4 ${isToday ? 'border-[var(--blue)] border' : ''}`}>
                {/* Time block */}
                <div className={`flex-shrink-0 w-16 text-center py-2 px-2 rounded-xl ${isToday ? 'bg-[var(--blue)] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <p className="text-xs font-medium">{new Date(a.appointment_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</p>
                  <p className="text-lg font-bold leading-tight">{new Date(a.appointment_date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                {/* Patient */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {a.patient?.first_name?.[0]}{a.patient?.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{a.patient?.first_name} {a.patient?.last_name}</p>
                    <p className="text-xs text-gray-400">{a.patient?.phone || '—'}</p>
                  </div>
                </div>
                {/* Treatment */}
                <div className="hidden md:block flex-1 min-w-0">
                  {a.treatment ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: (a.treatment.color || '#2563EB') + '18', color: a.treatment.color || '#2563EB' }}>
                      {a.treatment.name}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </div>
                {/* Status */}
                <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {isToday && <span className="text-xs bg-[var(--blue)] text-white px-2 py-1 rounded-full font-medium flex-shrink-0">Aujourd'hui</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal max-w-lg w-full">
            <div className="modal-header">
              <p className="modal-title">Nouveau rendez-vous</p>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Patient *</label>
                <select value={form.patient_id} onChange={e => setForm(f => ({...f, patient_id: e.target.value}))} className="input">
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date et heure *</label>
                <input type="datetime-local" value={form.appointment_date} onChange={e => setForm(f => ({...f, appointment_date: e.target.value}))} className="input" />
              </div>
              <div>
                <label className="label">Traitement</label>
                <select value={form.treatment_id} onChange={e => setForm(f => ({...f, treatment_id: e.target.value}))} className="input">
                  <option value="">— Aucun —</option>
                  {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} className="input resize-none" placeholder="Informations supplémentaires..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
              <button onClick={createAppointment} disabled={!form.patient_id || !form.appointment_date || saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Création...' : 'Créer le RDV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
