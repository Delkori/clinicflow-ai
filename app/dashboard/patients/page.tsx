'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getInitials } from '@/lib/utils'
import type { Patient, Treatment } from '@/lib/types'
import Link from 'next/link'

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  const loadPatients = useCallback(async () => {
    let q = supabase.from('patients').select('*').order('created_at', { ascending: false })
    if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    const { data } = await q
    setPatients(data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    loadPatients()
    supabase.from('treatments').select('*').then(({ data }) => setTreatments(data ?? []))
  }, [loadPatients])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 text-sm mt-1">{patients.length} patient{patients.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          + Nouveau patient
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un patient..." 
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-500 font-medium">Aucun patient trouvé</p>
            <p className="text-gray-400 text-sm mt-1">Ajoutez votre premier patient pour commencer</p>
            <button onClick={() => setShowModal(true)}
              className="mt-4 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
              + Ajouter un patient
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Patient</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Source</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {getInitials(`${p.first_name} ${p.last_name}`)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                        {p.date_of_birth && <p className="text-xs text-gray-500">{formatDate(p.date_of_birth)}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{p.email}</p>
                    <p className="text-xs text-gray-500">{p.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      p.source === 'doctolib' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.source === 'doctolib' ? '📅 Doctolib' : '✋ Manuel'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/patients/${p.id}`}
                      className="text-violet-600 hover:text-violet-800 text-xs font-medium">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Patient Modal */}
      {showModal && (
        <NewPatientModal
          treatments={treatments}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadPatients() }}
        />
      )}
    </div>
  )
}

function NewPatientModal({ onClose, onCreated, treatments }: {
  onClose: () => void
  onCreated: () => void
  treatments: Treatment[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', source: 'manual', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!profile) return

    const { error } = await supabase.from('patients').insert({
      ...form,
      clinic_id: profile.clinic_id,
      date_of_birth: form.date_of_birth || null,
    })
    if (error) { setError(error.message); setLoading(false) }
    else onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Nouveau patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
              <input type="text" value={form.first_name} onChange={update('first_name')} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
              <input type="text" value={form.last_name} onChange={update('last_name')} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={update('email')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.phone} onChange={update('phone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date de naissance</label>
              <input type="date" value={form.date_of_birth} onChange={update('date_of_birth')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
            <select value={form.source} onChange={update('source')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="manual">Manuel</option>
              <option value="doctolib">Doctolib</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={update('notes')} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium py-2 transition-colors">
              {loading ? 'Création...' : 'Créer le patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
