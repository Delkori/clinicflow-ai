'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [clinic, setClinic] = useState<any>(null)
  const [stats, setStats] = useState({ patients: 0, consultations: 0, appointments: 0, automations: 0 })
  const [todayActions, setTodayActions] = useState<any[]>([])
  const [recentPatients, setRecentPatients] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) return
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      setClinic(cl)
      const clinicId = prof.clinic_id
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999)

      const [
        { count: pCount },
        { count: cCount },
        { count: aCount },
        { count: autoCount },
        { data: actions },
        { data: recent },
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
        supabase.from('workflow_executions').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'sent'),
        supabase.from('workflow_executions')
          .select('*, patient:patients(first_name,last_name,phone), step:workflow_steps(*)')
          .eq('clinic_id', clinicId).eq('status', 'pending')
          .gte('scheduled_at', todayStart.toISOString())
          .lte('scheduled_at', todayEnd.toISOString())
          .order('scheduled_at'),
        supabase.from('patients').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }).limit(5),
      ])

      setStats({ patients: pCount ?? 0, consultations: cCount ?? 0, appointments: aCount ?? 0, automations: autoCount ?? 0 })
      setTodayActions(actions ?? [])
      setRecentPatients(recent ?? [])

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i))
        return { label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), consultations: Math.floor(Math.random()*4), patients: Math.floor(Math.random()*2) }
      })
      setChartData(days)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function sendAction(action: any) {
    if (!action.patient?.phone) { showToast('❌ Pas de numéro pour ce patient'); return }
    setSending(action.id)
    const vars: Record<string,string> = { first_name: action.patient.first_name, last_name: action.patient.last_name }
    const message = (action.step?.template_body || 'Bonjour {{first_name}}, message de votre clinique.').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] ?? '')
    const res = await fetch('/api/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_id: action.id, patient_id: action.patient_id, phone: action.patient.phone, message, clinic_id: clinic?.id }),
    })
    const result = await res.json()
    setSending(null)
    showToast(result.simulated ? `💬 Simulé → ${action.patient.first_name} ${action.patient.last_name}` : `✅ WhatsApp envoyé → ${action.patient.first_name}`)
    setTodayActions(prev => prev.filter(a => a.id !== action.id))
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>

  const KPIS = [
    { label: 'Patients',        value: stats.patients,       icon: '👤', bg: 'var(--blue-light)',   color: 'var(--blue)',   href: '/dashboard/patients' },
    { label: 'Consultations',   value: stats.consultations,  icon: '🩺', bg: '#F3EEFF',              color: '#7C3AED',       href: '/dashboard/consultations' },
    { label: 'Rendez-vous',     value: stats.appointments,   icon: '📅', bg: 'var(--green-light)',   color: 'var(--green)',  href: '/dashboard/appointments' },
    { label: 'Messages envoyés',value: stats.automations,    icon: '💬', bg: 'var(--orange-light)',  color: 'var(--orange)', href: '/dashboard/automations' },
  ]

  const TYPE_COLORS: Record<string,string> = {
    whatsapp: 'bg-green-100 text-green-700',
    email:    'bg-blue-100 text-blue-700',
    sms:      'bg-violet-100 text-violet-700',
    wait:     'bg-gray-100 text-gray-500',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white rounded-xl px-5 py-3 text-sm font-medium shadow-xl">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clinic?.name} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary">+ Nouvelle consultation</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIS.map(k => (
          <Link key={k.label} href={k.href} className="card p-5 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{k.icon}</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: k.bg }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: k.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{k.value}</p>
            <p className="text-sm text-gray-500 mt-1">{k.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-6 mb-6">
        {/* Chart */}
        <div className="card p-5">
          <p className="font-semibold text-gray-900 mb-4">Activité — 7 derniers jours</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--blue)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }} />
              <Area type="monotone" dataKey="consultations" stroke="var(--blue)"  fill="url(#gBlue)" strokeWidth={2} name="Consultations" />
              <Area type="monotone" dataKey="patients"      stroke="var(--green)" fill="none"        strokeWidth={2} strokeDasharray="4 2" name="Nouveaux patients" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Actions du jour */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-900">Actions du jour</p>
            {todayActions.length > 0 && (
              <span className="w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">{todayActions.length}</span>
            )}
          </div>
          {todayActions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-6">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium text-gray-500">Tout est à jour !</p>
              <p className="text-xs text-gray-400 mt-1">Aucune action planifiée pour aujourd'hui</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto max-h-56">
              {todayActions.map(a => (
                <div key={a.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${TYPE_COLORS[a.step?.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {a.step?.type ?? 'action'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{a.patient?.first_name} {a.patient?.last_name}</p>
                    <p className="text-xs text-gray-400 truncate">{a.step?.template_name}</p>
                  </div>
                  {a.step?.type === 'whatsapp' && (
                    <button onClick={() => sendAction(a)} disabled={sending === a.id}
                      className="btn-primary py-1 px-2.5 text-xs flex-shrink-0 disabled:opacity-50">
                      {sending === a.id ? '...' : '▶ Envoyer'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent patients */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">Patients récents</p>
          <Link href="/dashboard/patients" className="text-sm text-[var(--blue)] hover:underline">Voir tous →</Link>
        </div>
        {recentPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Aucun patient pour le moment.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentPatients.map(p => (
              <Link key={p.id} href={`/dashboard/patients/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50 px-2 rounded-xl transition-colors">
                <div className="w-9 h-9 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-gray-400">{p.email || p.phone || '—'}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
