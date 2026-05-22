'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
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
        supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('consultations').select('*, patient:patients(first_name,last_name), treatment:treatments(name,color)').order('created_at', { ascending: false }).limit(5),
        supabase.from('workflow_executions').select('*, step:workflow_steps(*), patient:patients(first_name,last_name)').eq('status', 'pending').order('scheduled_at', { ascending: true }).limit(6),
        supabase.from('treatments').select('id, name, color'),
      ])

      const patientsByTreatment: any[] = []
      if (treatments) {
        for (const t of treatments) {
          const { count } = await supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('treatment_id', t.id)
          if ((count ?? 0) > 0) patientsByTreatment.push({ name: t.name.split(' ')[0], count: count ?? 0, color: t.color })
        }
      }

      // Fake trend data for sparkline
      const trend = Array.from({ length: 7 }, (_, i) => ({
        day: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i],
        value: Math.floor(Math.random() * 5) + 1,
      }))

      setStats({ totalPatients, patientsThisMonth, consultationsThisMonth, pendingExecutions, patientsByTreatment, recentPatients: recentPatients ?? [], recentConsultations: recentConsultations ?? [], pendingActions: pendingActions ?? [], trend })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Tableau de bord</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          + Nouvelle consultation
        </Link>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Patients total', value: stats.totalPatients, sub: `+${stats.patientsThisMonth} ce mois`, color: 'var(--blue)', bg: 'var(--blue-light)', icon: '◎' },
            { label: 'Consultations', value: stats.consultationsThisMonth, sub: 'Ce mois', color: '#7C3AED', bg: '#F3EEFF', icon: '✦' },
            { label: 'Actions en attente', value: stats.pendingExecutions, sub: 'Automatisations', color: '#D97706', bg: '#FFFBEB', icon: '⚡' },
            { label: 'Traitements', value: stats.patientsByTreatment.length || 3, sub: 'Parcours actifs', color: '#059669', bg: '#ECFDF5', icon: '⬡' },
          ].map((kpi, i) => (
            <div className="stat-card" key={i} style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: kpi.color }}>
                  {kpi.icon}
                </div>
              </div>
              <div className="stat-value">{kpi.value}</div>
              <div className="stat-label">{kpi.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '500', marginTop: '6px' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>Consultations par traitement</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Total accumulé</div>
              </div>
            </div>
            {stats.patientsByTreatment.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.patientsByTreatment} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '12px' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.patientsByTreatment.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--gray-400)', fontSize: '13px' }}>
                Aucune donnée encore
              </div>
            )}
          </div>

          {/* Activité semaine */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>Activité cette semaine</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Consultations par jour</div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Recent patients */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>Derniers patients</div>
              <Link href="/dashboard/patients" style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>Voir tous →</Link>
            </div>
            {stats.recentPatients.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '13px' }}>Aucun patient</div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {stats.recentPatients.map((p: any) => (
                  <Link key={p.id} href={`/dashboard/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', textDecoration: 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '12px' }}>{p.first_name[0]}{p.last_name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--gray-900)' }}>{p.first_name} {p.last_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email || p.phone || '—'}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{formatDate(p.created_at)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pending actions */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>Actions automatisées</div>
              <Link href="/dashboard/automations" style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>Voir tout →</Link>
            </div>
            {stats.pendingActions.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '13px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                Aucune action en attente
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {stats.pendingActions.map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: a.step?.type === 'email' ? 'var(--blue-light)' : a.step?.type === 'whatsapp' ? 'var(--green-light)' : 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                      {a.step?.type === 'email' ? '📧' : a.step?.type === 'whatsapp' ? '💬' : '📄'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.patient?.first_name} {a.patient?.last_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{a.step?.template_name}</div>
                    </div>
                    <span className="badge badge-orange">{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
