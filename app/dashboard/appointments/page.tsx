'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, formatDate } from '@/lib/utils'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'today'>('upcoming')
  const supabase = createClient()

  async function load() {
    let q = supabase.from('appointments')
      .select('*, patient:patients(first_name, last_name, email), treatment:treatments(name, color)')
      .order('appointment_date', { ascending: true })
    if (filter === 'upcoming') q = q.gte('appointment_date', new Date().toISOString())
    if (filter === 'today') {
      const start = new Date(); start.setHours(0,0,0,0)
      const end = new Date(); end.setHours(23,59,59,999)
      q = q.gte('appointment_date', start.toISOString()).lte('appointment_date', end.toISOString())
    }
    const { data } = await q
    setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-green-100 text-green-700' :
    s === 'confirmed' ? 'bg-blue-100 text-blue-700' :
    s === 'cancelled' ? 'bg-red-100 text-red-700' :
    'bg-amber-100 text-amber-700'

  const typeIcon = (t: string) => ({ consultation: '🩺', intervention: '🔬', suivi: '👁️', control: '✅' }[t] ?? '📅')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm mt-1">{appointments.length} rendez-vous</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nouveau RDV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(['upcoming', 'today', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'upcoming' ? '📅 À venir' : f === 'today' ? "📌 Aujourd'hui" : '🗂️ Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-4xl mb-2">📅</p>
          <p>Aucun rendez-vous {filter === 'today' ? "aujourd'hui" : filter === 'upcoming' ? 'à venir' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a: any) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                {typeIcon(a.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{a.patient?.first_name} {a.patient?.last_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">{formatDateTime(a.appointment_date)}</span>
                  {a.treatment && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="w-2 h-2 rounded-full" style={{ background: a.treatment.color }} />
                      {a.treatment.name}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor(a.status)}`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function NewAppointmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [patients, setPatients] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [clinicId, setClinicId] = useState('')
  const [form, setForm] = useState({ patient_id: '', treatment_id: '', appointment_date: '', type: 'consultation', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!profile) return
      setClinicId(profile.clinic_id)
      const [{ data: pts }, { data: trts }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').order('last_name'),
        supabase.from('treatments').select('id, name'),
      ])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
    }
    load()
  }, [])

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('appointments').insert({ ...form, clinic_id: clinicId, treatment_id: form.treatment_id || null })
    setLoading(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Nouveau rendez-vous</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Patient *</label>
            <select value={form.patient_id} onChange={update('patient_id')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Choisir...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.type} onChange={update('type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="consultation">🩺 Consultation</option>
                <option value="intervention">🔬 Intervention</option>
                <option value="suivi">👁️ Suivi</option>
                <option value="control">✅ Contrôle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Traitement</label>
              <select value={form.treatment_id} onChange={update('treatment_id')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">—</option>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date & heure *</label>
            <input type="datetime-local" value={form.appointment_date} onChange={update('appointment_date')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={update('notes')} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
              {loading ? 'Enregistrement...' : 'Créer le RDV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
