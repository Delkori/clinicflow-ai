'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  completed:   { label: 'Terminée',    bg: 'bg-green-50',   color: 'text-green-700',  dot: 'bg-green-400' },
  in_progress: { label: 'En cours',    bg: 'bg-blue-50',    color: 'text-blue-700',   dot: 'bg-blue-400'  },
  scheduled:   { label: 'Planifiée',   bg: 'bg-amber-50',   color: 'text-amber-700',  dot: 'bg-amber-400' },
  cancelled:   { label: 'Annulée',     bg: 'bg-red-50',     color: 'text-red-600',    dot: 'bg-red-400'   },
}

export default function ConsultationsPage() {
  const supabase = createClient()
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clinicId, setClinicId] = useState<string | null>(null)

  const load = useCallback(async (cId: string) => {
    let q = supabase
      .from('consultations')
      .select('*, patient:patients(first_name,last_name,phone), treatment:treatments(name,color)')
      .eq('clinic_id', cId)
      .order('consultation_date', { ascending: false })
    if (search) q = q.or(`patients.first_name.ilike.%${search}%,patients.last_name.ilike.%${search}%`)
    const { data } = await q
    setConsultations(data ?? [])
    setLoading(false)
  }, [search, supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('clinic_id').eq('id', user.id).single().then(({ data }) => {
        if (data) { setClinicId(data.clinic_id); load(data.clinic_id) }
      })
    })
  }, [supabase, load])

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Consultations</h1>
          <p className="text-sm text-gray-400 mt-0.5">{consultations.length} consultation{consultations.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary">+ Nouvelle consultation</Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); if (clinicId) load(clinicId) }}
          placeholder="Rechercher un patient..."
          className="input pl-9 w-full max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-4xl mb-3">🩺</p>
          <p className="font-semibold text-gray-900 mb-1">Aucune consultation</p>
          <p className="text-sm text-gray-400 mb-5">Créez votre première consultation pour commencer</p>
          <Link href="/dashboard/consultations/new" className="btn-primary">+ Nouvelle consultation</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Traitement</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">IA</th>
                <th className="px-5 py-3.5 bg-gray-50 border-b border-gray-100" />
              </tr>
            </thead>
            <tbody>
              {consultations.map((c, i) => {
                const s = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.scheduled
                return (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {c.patient?.first_name?.[0]}{c.patient?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{c.patient?.first_name} {c.patient?.last_name}</p>
                          <p className="text-xs text-gray-400">{c.patient?.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {c.treatment ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: (c.treatment.color || '#2563EB') + '18', color: c.treatment.color || '#2563EB' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.treatment.color || '#2563EB' }} />
                          {c.treatment.name}
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.consultation_date ? fmt(c.consultation_date) : '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {c.ai_summary ? (
                        <span className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-medium">✨ IA</span>
                      ) : c.transcription ? (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">🎙️ Audio</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/dashboard/consultations/${c.id}`} className="text-sm text-[var(--blue)] hover:underline font-medium">Voir →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
