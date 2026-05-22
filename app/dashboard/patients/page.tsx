'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STAGE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  lead:         { label: 'Lead',        bg: 'bg-gray-100',    color: 'text-gray-600'   },
  consultation: { label: 'Consultation',bg: 'bg-blue-50',     color: 'text-blue-700'   },
  devis:        { label: 'Devis',       bg: 'bg-amber-50',    color: 'text-amber-700'  },
  consent:      { label: 'Consentement',bg: 'bg-violet-50',   color: 'text-violet-700' },
  rdv:          { label: 'RDV programmé',bg: 'bg-cyan-50',    color: 'text-cyan-700'   },
  postop:       { label: 'Post-op',     bg: 'bg-green-50',    color: 'text-green-700'  },
}

export default function PatientsPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', notes: '' })

  const load = useCallback(async (cId: string, q = '') => {
    let query = supabase
      .from('patients')
      .select('*, consultations(id), appointments(id)')
      .eq('clinic_id', cId)
      .order('created_at', { ascending: false })
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    const { data } = await query
    setPatients(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('clinic_id').eq('id', user.id).single().then(({ data }) => {
        if (data) { setClinicId(data.clinic_id); load(data.clinic_id) }
      })
    })
  }, [supabase, load])

  async function createPatient() {
    if (!form.first_name || !form.last_name || !clinicId) return
    setSaving(true)
    const { data } = await supabase.from('patients').insert({
      ...form, clinic_id: clinicId, source: 'manuel', kanban_stage: 'lead',
      date_of_birth: form.date_of_birth || null,
    }).select('*, consultations(id), appointments(id)').single()
    if (data) setPatients(prev => [data, ...prev])
    setSaving(false)
    setShowModal(false)
    setForm({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', notes: '' })
  }

  const debounced = useCallback((val: string) => {
    setSearch(val)
    if (clinicId) load(clinicId, val)
  }, [clinicId, load])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{patients.length} patient{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/import" className="btn-secondary">📥 Importer</Link>
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau patient</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          value={search}
          onChange={e => debounced(e.target.value)}
          placeholder="Rechercher par nom, email ou téléphone..."
          className="input pl-9 w-full max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
      ) : patients.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-semibold text-gray-900 mb-1">Aucun patient</p>
          <p className="text-sm text-gray-400 mb-5">Ajoutez votre premier patient ou importez depuis Doctolib</p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/import" className="btn-secondary">📥 Importer Doctolib</Link>
            <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau patient</button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Étape</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Activité</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const stage = STAGE_CONFIG[p.kanban_stage ?? 'lead'] ?? STAGE_CONFIG.lead
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                          {p.date_of_birth && <p className="text-xs text-gray-400">{new Date(p.date_of_birth).toLocaleDateString('fr-FR')}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-gray-600">{p.phone || '—'}</p>
                      <p className="text-xs text-gray-400">{p.email || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex gap-2">
                        <span className="text-xs bg-[var(--blue-light)] text-[var(--blue)] px-2 py-0.5 rounded-full font-medium">🩺 {p.consultations?.length ?? 0}</span>
                        <span className="text-xs bg-[var(--green-light)] text-[var(--green)] px-2 py-0.5 rounded-full font-medium">📅 {p.appointments?.length ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/dashboard/patients/${p.id}`} className="text-sm text-[var(--blue)] hover:underline font-medium">Voir →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal max-w-lg w-full">
            <div className="modal-header">
              <p className="modal-title">Nouveau patient</p>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom *</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} className="input" placeholder="Jean" />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} className="input" placeholder="Dupont" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input" placeholder="jean@email.com" />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="input" placeholder="+33 6 12 34 56 78" />
              </div>
              <div>
                <label className="label">Date de naissance</label>
                <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({...f, date_of_birth: e.target.value}))} className="input" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} className="input resize-none" placeholder="Informations complémentaires..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
              <button onClick={createPatient} disabled={!form.first_name || !form.last_name || saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Création...' : 'Créer le patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
