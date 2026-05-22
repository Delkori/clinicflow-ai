'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { Patient, Consultation, WorkflowExecution, Treatment } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Stats {
  totalPatients: number
  patientsThisMonth: number
  consultationsThisMonth: number
  pendingExecutions: number
  patientsByTreatment: Array<{ name: string; count: number; color: string }>
  recentPatients: Patient[]
  recentConsultations: Consultation[]
  pendingActions: WorkflowExecution[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        { count: totalPatients },
        { count: patientsThisMonth },
        { count: consultationsThisMonth },
        { count: pendingExecutions },
        { data: recentPatients },
        { data: recentConsultations },
        { data: pendingActions },
        { data: treatments },
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('workflow_executions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('consultations').select('*, patient:patients(*), treatment:treatments(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('workflow_executions').select('*, step:workflow_steps(*), patient:patients(*)').eq('status', 'pending').order('scheduled_at', { ascending: true }).limit(8),
        supabase.from('treatments').select('id, name, color'),
      ])

      // Count patients per treatment
      const patientsByTreatment: Array<{ name: string; count: number; color: string }> = []
      if (treatments) {
        for (const t of treatments) {
          const { count } = await supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('treatment_id', t.id)
          patientsByTreatment.push({ name: t.name, count: count ?? 0, color: t.color })
        }
      }

      setStats({
        totalPatients: totalPatients ?? 0,
        patientsThisMonth: patientsThisMonth ?? 0,
        consultationsThisMonth: consultationsThisMonth ?? 0,
        pendingExecutions: pendingExecutions ?? 0,
        patientsByTreatment,
        recentPatients: recentPatients ?? [],
        recentConsultations: (recentConsultations ?? []) as unknown as Consultation[],
        pendingActions: (pendingActions ?? []) as unknown as WorkflowExecution[],
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
    </div>
  )

  const kpis = [
    { label: 'Patients total', value: stats?.totalPatients ?? 0, icon: '👥', sub: `+${stats?.patientsThisMonth} ce mois`, color: 'bg-violet-50 border-violet-200' },
    { label: 'Consultations (mois)', value: stats?.consultationsThisMonth ?? 0, icon: '🩺', sub: 'Ce mois en cours', color: 'bg-blue-50 border-blue-200' },
    { label: 'Actions en attente', value: stats?.pendingExecutions ?? 0, icon: '⏳', sub: 'Automatisations', color: 'bg-amber-50 border-amber-200' },
    { label: 'Traitements actifs', value: stats?.patientsByTreatment.length ?? 0, icon: '💊', sub: 'Types de parcours', color: 'bg-green-50 border-green-200' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
              </div>
              <span className="text-2xl">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Consultations par traitement</h2>
          {stats?.patientsByTreatment && stats.patientsByTreatment.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.patientsByTreatment} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Consultations']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.patientsByTreatment.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Aucune donnée — ajoutez des traitements et consultations
            </div>
          )}
        </div>

        {/* Pending actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">⏳ Actions en attente</h2>
          {stats?.pendingActions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Aucune action en attente ✅</div>
          ) : (
            <div className="space-y-2">
              {stats?.pendingActions.map(action => (
                <div key={action.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs">
                  <span>{action.step?.type === 'email' ? '📧' : action.step?.type === 'whatsapp' ? '💬' : '📄'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{(action as any).patient?.first_name} {(action as any).patient?.last_name}</p>
                    <p className="text-gray-500 truncate">{action.step?.template_name}</p>
                  </div>
                  {action.scheduled_at && <span className="text-gray-400 flex-shrink-0">{formatDate(action.scheduled_at)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent patients */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">👥 Derniers patients</h2>
            <a href="/dashboard/patients" className="text-xs text-violet-600 hover:underline">Voir tous →</a>
          </div>
          {stats?.recentPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Aucun patient encore</div>
          ) : (
            <div className="space-y-2">
              {stats?.recentPatients.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">{p.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent consultations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">🩺 Dernières consultations</h2>
            <a href="/dashboard/consultations" className="text-xs text-violet-600 hover:underline">Voir toutes →</a>
          </div>
          {stats?.recentConsultations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Aucune consultation encore</div>
          ) : (
            <div className="space-y-2">
              {stats?.recentConsultations.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.treatment?.color ?? '#8b5cf6' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{c.patient?.first_name} {c.patient?.last_name}</p>
                    <p className="text-xs text-gray-500">{c.treatment?.name ?? 'Sans traitement'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    c.status === 'completed' ? 'bg-green-100 text-green-700' :
                    c.status === 'validated' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
