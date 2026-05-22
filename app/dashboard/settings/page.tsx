'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Treatment, Clinic, Profile } from '@/lib/types'

export default function SettingsPage() {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [activeTab, setActiveTab] = useState<'clinic' | 'treatments' | 'account'>('clinic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [showNewTreatment, setShowNewTreatment] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) return
      setProfile(prof)
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      if (cl) { setClinic(cl); setClinicName(cl.name) }
      const { data: trts } = await supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id).order('created_at')
      setTreatments(trts ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function saveClinic() {
    if (!clinic) return
    setSaving(true)
    await supabase.from('clinics').update({ name: clinicName }).eq('id', clinic.id)
    setClinic(c => c ? { ...c, name: clinicName } : c)
    setSaving(false)
  }

  async function deleteTreatment(id: string) {
    if (!confirm('Supprimer ce traitement ? Les workflows associés seront également supprimés.')) return
    await supabase.from('treatments').delete().eq('id', id)
    setTreatments(ts => ts.filter(t => t.id !== id))
  }

  async function seedDefaults() {
    if (!clinic) return
    await supabase.rpc('seed_clinic_defaults', { p_clinic_id: clinic.id })
    const { data } = await supabase.from('treatments').select('*').eq('clinic_id', clinic.id)
    setTreatments(data ?? [])
    alert('Traitements et workflows par défaut ajoutés !')
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full" /></div>

  const tabs = [
    { id: 'clinic', label: '🏥 Clinique' },
    { id: 'treatments', label: '💊 Traitements' },
    { id: 'account', label: '👤 Compte' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Paramètres</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'clinic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informations de la clinique</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la clinique</label>
            <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ID Clinique</label>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg font-mono">{clinic?.id}</p>
          </div>
          <button onClick={saveClinic} disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          {/* Seed defaults */}
          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium text-gray-900 mb-2">Données de démarrage</h3>
            <p className="text-sm text-gray-500 mb-3">Ajoutez les traitements et workflows par défaut (Greffe, Laser, HA)</p>
            <button onClick={seedDefaults}
              className="border border-violet-300 text-violet-600 hover:bg-violet-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              🚀 Importer les traitements & workflows par défaut
            </button>
          </div>
        </div>
      )}

      {activeTab === 'treatments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{treatments.length} traitement{treatments.length > 1 ? 's' : ''}</p>
            <button onClick={() => setShowNewTreatment(true)}
              className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
              + Nouveau traitement
            </button>
          </div>
          <div className="space-y-2">
            {treatments.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <button onClick={() => deleteTreatment(t.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-sm">🗑️</button>
              </div>
            ))}
            {treatments.length === 0 && (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-3xl mb-2">💊</p>
                <p className="text-sm">Aucun traitement configuré</p>
              </div>
            )}
          </div>

          {showNewTreatment && (
            <NewTreatmentModal
              clinicId={clinic?.id ?? ''}
              onClose={() => setShowNewTreatment(false)}
              onCreated={(t) => { setTreatments(ts => [...ts, t]); setShowNewTreatment(false) }}
            />
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Mon compte</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom complet</label>
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{profile?.full_name}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{profile?.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
            <span className="inline-block text-sm px-3 py-1 bg-violet-100 text-violet-700 rounded-full capitalize">{profile?.role}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function NewTreatmentModal({ clinicId, onClose, onCreated }: {
  clinicId: string, onClose: () => void, onCreated: (t: Treatment) => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', description: '', color: '#8b5cf6' })
  const [loading, setLoading] = useState(false)

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase.from('treatments').insert({ ...form, clinic_id: clinicId }).select().single()
    setLoading(false)
    if (data) onCreated(data as Treatment)
  }

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#6366f1']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Nouveau traitement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
            <input type="text" value={form.name} onChange={update('name')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Greffe de cheveux, Laser..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={update('description')} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Couleur</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
