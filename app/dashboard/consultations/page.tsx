'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('consultations')
      .select('*, patient:patients(first_name, last_name), treatment:treatments(name, color)')
      .order('consultation_date', { ascending: false })
    setConsultations(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-green-100 text-green-700' :
    s === 'validated' ? 'bg-blue-100 text-blue-700' :
    'bg-amber-100 text-amber-700'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
          <p className="text-gray-500 text-sm mt-1">{consultations.length} consultation{consultations.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/consultations/new"
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nouvelle consultation
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-gray-500 font-medium">Aucune consultation</p>
            <Link href="/dashboard/consultations/new"
              className="mt-4 inline-block bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
              Créer la première consultation
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Patient</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Traitement</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">IA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consultations.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {c.patient?.first_name} {c.patient?.last_name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {c.treatment ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: c.treatment.color }} />
                        <span className="text-sm text-gray-700">{c.treatment.name}</span>
                      </span>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(c.consultation_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.transcription ? (
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">✓ Transcrit</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/consultations/${c.id}`}
                      className="text-violet-600 hover:text-violet-800 text-xs font-medium">Voir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
