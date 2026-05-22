'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, STEP_TYPE_LABELS, STEP_TYPE_COLORS } from '@/lib/utils'

export default function AutomationsPage() {
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      let q = supabase
        .from('workflow_executions')
        .select('*, patient:patients(first_name, last_name), step:workflow_steps(type, template_name, timing_days, timing_reference), workflow:workflows(name)')
        .order('scheduled_at', { ascending: true })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q
      setExecutions(data ?? [])
      setLoading(false)
    }
    load()
  }, [filter])

  async function markAsSent(id: string) {
    await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', id)
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, status: 'sent', executed_at: new Date().toISOString() } : e))
  }

  const counts = { pending: 0, sent: 0, failed: 0 }
  executions.forEach(e => { if (counts[e.status as keyof typeof counts] !== undefined) counts[e.status as keyof typeof counts]++ })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Automatisations</h1>
        <p className="text-gray-500 text-sm mt-1">Log des actions automatisées du parcours patient</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-700">{executions.filter(e => e.status === 'pending').length}</p>
          <p className="text-xs text-amber-600 mt-1">En attente</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{executions.filter(e => e.status === 'sent').length}</p>
          <p className="text-xs text-green-600 mt-1">Envoyées</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{executions.filter(e => e.status === 'failed').length}</p>
          <p className="text-xs text-red-600 mt-1">Échouées</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'sent', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'all' ? 'Tous' : f === 'pending' ? '⏳ En attente' : f === 'sent' ? '✅ Envoyées' : '❌ Échouées'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-4xl mb-2">🤖</p>
          <p>Aucune automatisation {filter !== 'all' ? `avec statut "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Patient</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Action</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Workflow</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Planifié</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {executions.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{e.patient?.first_name} {e.patient?.last_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_COLORS[e.step?.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STEP_TYPE_LABELS[e.step?.type] ?? e.step?.type}
                      </span>
                      <span className="text-xs text-gray-600">{e.step?.template_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.workflow?.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.scheduled_at ? formatDateTime(e.scheduled_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      e.status === 'sent' ? 'bg-green-100 text-green-700' :
                      e.status === 'failed' ? 'bg-red-100 text-red-700' :
                      e.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.status === 'pending' && (
                      <button onClick={() => markAsSent(e.id)}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        Marquer envoyé
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
