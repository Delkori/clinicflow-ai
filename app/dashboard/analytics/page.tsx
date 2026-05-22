'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, FunnelChart, Funnel, LabelList,
} from 'recharts'

const COLORS = ['#2563EB', '#7C3AED', '#059669', '#F59E0B', '#EF4444', '#0891B2']

function KPICard({ label, value, sub, icon, color }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: color + '20', color }}>{sub}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d'|'30d'|'90d'>('30d')

  // Data states
  const [kpis, setKpis] = useState({ patients: 0, consultations: 0, appointments: 0, messages: 0, conversionRate: 0, avgConsPerPatient: 0 })
  const [activityData, setActivityData] = useState<any[]>([])
  const [treatmentData, setTreatmentData] = useState<any[]>([])
  const [funnelData, setFunnelData] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [sourceData, setSourceData] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      const clinicId = prof.clinic_id

      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const since = new Date(); since.setDate(since.getDate() - days)

      const [
        { count: pTotal },
        { count: pNew },
        { count: cTotal },
        { count: aTotal },
        { count: msgSent },
        { data: consultations },
        { data: patients },
        { data: treatments },
        { data: logs },
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', since.toISOString()),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', since.toISOString()),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', since.toISOString()),
        supabase.from('automation_logs').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'success').gte('created_at', since.toISOString()),
        supabase.from('consultations').select('consultation_date, treatment_id, treatments(name, color)').eq('clinic_id', clinicId).gte('consultation_date', since.toISOString()),
        supabase.from('patients').select('created_at, source, kanban_stage').eq('clinic_id', clinicId).gte('created_at', since.toISOString()),
        supabase.from('treatments').select('id, name, color').eq('clinic_id', clinicId),
        supabase.from('automation_logs').select('channel, status, created_at').eq('clinic_id', clinicId).gte('created_at', since.toISOString()),
      ])

      const convRate = pNew && cTotal ? Math.round((cTotal / pNew) * 100) : 0
      const avgCons = pTotal && cTotal ? Math.round((cTotal / pTotal) * 10) / 10 : 0
      setKpis({ patients: pTotal ?? 0, consultations: cTotal ?? 0, appointments: aTotal ?? 0, messages: msgSent ?? 0, conversionRate: convRate, avgConsPerPatient: avgCons })

      // Activity timeline — group by day
      const buckets: Record<string, { label: string, patients: number, consultations: number, messages: number }> = {}
      const bucketCount = days <= 7 ? days : days <= 30 ? 30 : 12
      for (let i = bucketCount - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = days <= 30 ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (!buckets[key]) buckets[key] = { label: key, patients: 0, consultations: 0, messages: 0 }
      }
      for (const p of patients ?? []) {
        const d = new Date(p.created_at)
        const key = days <= 30 ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (buckets[key]) buckets[key].patients++
      }
      for (const c of consultations ?? []) {
        const d = new Date(c.consultation_date)
        const key = days <= 30 ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (buckets[key]) buckets[key].consultations++
      }
      setActivityData(Object.values(buckets))

      // Treatments breakdown
      const tMap: Record<string, { name: string; count: number; color: string }> = {}
      for (const c of consultations ?? []) {
        if (!c.treatment_id) { tMap['_none'] = { name: 'Sans traitement', count: (tMap['_none']?.count ?? 0) + 1, color: '#9CA3AF' }; continue }
        const t = (c as any).treatments
        const key = c.treatment_id
        tMap[key] = { name: t?.name ?? 'Inconnu', count: (tMap[key]?.count ?? 0) + 1, color: t?.color ?? '#2563EB' }
      }
      setTreatmentData(Object.values(tMap).sort((a,b) => b.count - a.count))

      // Funnel — kanban stages
      const stageCounts: Record<string, number> = {}
      for (const p of patients ?? []) { const s = p.kanban_stage ?? 'lead'; stageCounts[s] = (stageCounts[s] ?? 0) + 1 }
      const stageOrder = ['lead','consultation','devis','consent','rdv','postop']
      const stageLabels: Record<string,string> = { lead: 'Leads', consultation: 'Consultation', devis: 'Devis envoyé', consent: 'Consentement', rdv: 'RDV programmé', postop: 'Post-op' }
      setFunnelData(stageOrder.filter(s => stageCounts[s]).map((s, i) => ({ name: stageLabels[s], value: stageCounts[s], fill: COLORS[i] })))

      // Channels
      const cMap: Record<string, { sent: number; failed: number }> = {}
      for (const l of logs ?? []) {
        const ch = l.channel ?? 'unknown'
        if (!cMap[ch]) cMap[ch] = { sent: 0, failed: 0 }
        if (l.status === 'success') cMap[ch].sent++; else cMap[ch].failed++
      }
      setChannelData(Object.entries(cMap).map(([ch, v]) => ({ channel: ch, ...v })))

      // Sources
      const sMap: Record<string, number> = {}
      for (const p of patients ?? []) { const s = p.source ?? 'manuel'; sMap[s] = (sMap[s] ?? 0) + 1 }
      setSourceData(Object.entries(sMap).map(([name, value]) => ({ name, value })))

      setLoading(false)
    }
    load()
  }, [period, supabase])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytiques</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue d'ensemble de l'activité de votre clinique</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['7d','30d','90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Patients total"       value={kpis.patients}           sub="+total"       icon="👤" color="#2563EB" />
        <KPICard label="Nouvelles consultations" value={kpis.consultations}    sub={`${period}`}  icon="🩺" color="#7C3AED" />
        <KPICard label="Rendez-vous"           value={kpis.appointments}       sub={`${period}`}  icon="📅" color="#059669" />
        <KPICard label="Messages envoyés"      value={kpis.messages}           sub={`${period}`}  icon="💬" color="#F59E0B" />
        <KPICard label="Taux de conversion"    value={`${kpis.conversionRate}%`} sub="leads→cons" icon="📈" color="#0891B2" />
        <KPICard label="Cons. / patient"       value={kpis.avgConsPerPatient}  sub="moyenne"      icon="⚡" color="#EF4444" />
      </div>

      {/* Activity chart */}
      <div className="card p-5">
        <p className="font-semibold text-gray-900 mb-4">Activité sur la période</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={activityData}>
            <defs>
              <linearGradient id="gBlue2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gGreen2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="consultations" stroke="#2563EB" fill="url(#gBlue2)" strokeWidth={2} name="Consultations" />
            <Area type="monotone" dataKey="patients"      stroke="#059669" fill="url(#gGreen2)" strokeWidth={2} name="Nouveaux patients" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Treatments breakdown */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 mb-4">Consultations par traitement</p>
          {treatmentData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Aucune consultation sur la période</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={treatmentData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Consultations">
                  {treatmentData.map((entry, index) => (
                    <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source breakdown */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 mb-4">Sources patients</p>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Aucun patient sur la période</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                    {sourceData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-gray-600 capitalize flex-1">{s.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel Kanban */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 mb-4">Entonnoir de conversion (nouveaux patients)</p>
          {funnelData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Aucune donnée de parcours</div>
          ) : (
            <div className="space-y-2">
              {funnelData.map((stage, i) => {
                const pct = funnelData[0]?.value ? Math.round((stage.value / funnelData[0].value) * 100) : 0
                return (
                  <div key={stage.name}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{stage.name}</span>
                      <span className="font-semibold text-gray-900">{stage.value} ({pct}%)</span>
                    </div>
                    <div className="w-full h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: stage.fill }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 mb-4">Messages par canal</p>
          {channelData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Aucun message envoyé sur la période</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelData}>
                <XAxis dataKey="channel" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sent"   name="Envoyés"  fill="#059669" radius={[4,4,0,0]} />
                <Bar dataKey="failed" name="Échoués"  fill="#EF4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
