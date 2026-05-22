'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const TYPE_CONFIG: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  whatsapp: { icon: '💬', label: 'WhatsApp', bg: 'bg-green-50',  color: 'text-green-700'  },
  email:    { icon: '📧', label: 'Email',    bg: 'bg-blue-50',   color: 'text-blue-700'   },
  sms:      { icon: '📱', label: 'SMS',      bg: 'bg-violet-50', color: 'text-violet-700' },
  wait:     { icon: '⏳', label: 'Délai',    bg: 'bg-gray-100',  color: 'text-gray-500'   },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  sent:    { label: 'Envoyé',    bg: 'bg-green-50',  color: 'text-green-700', dot: 'bg-green-400' },
  pending: { label: 'En attente',bg: 'bg-amber-50',  color: 'text-amber-700', dot: 'bg-amber-400' },
  failed:  { label: 'Échoué',    bg: 'bg-red-50',    color: 'text-red-600',   dot: 'bg-red-400'   },
  skipped: { label: 'Ignoré',    bg: 'bg-gray-100',  color: 'text-gray-500',  dot: 'bg-gray-300'  },
}

export default function AutomationsPage() {
  const supabase = createClient()
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'pending'|'sent'|'failed'>('all')
  const [stats, setStats] = useState({ total: 0, sent: 0, pending: 0, failed: 0 })
  const [sending, setSending] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      setClinic(cl)
      const { data } = await supabase
        .from('workflow_executions')
        .select('*, patient:patients(first_name,last_name,phone), step:workflow_steps(*)')
        .eq('clinic_id', prof.clinic_id)
        .order('scheduled_at', { ascending: false })
        .limit(100)
      const execs = data ?? []
      setExecutions(execs)
      setStats({
        total:   execs.length,
        sent:    execs.filter(e => e.status === 'sent').length,
        pending: execs.filter(e => e.status === 'pending').length,
        failed:  execs.filter(e => e.status === 'failed').length,
      })
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered = filter === 'all' ? executions : executions.filter(e => e.status === filter)

  async function send(exec: any) {
    if (!exec.patient?.phone) return
    setSending(exec.id)
    const vars: Record<string,string> = { first_name: exec.patient.first_name, last_name: exec.patient.last_name }
    const msg = (exec.step?.template_body || 'Bonjour {{first_name}}, message de votre clinique.').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] ?? '')
    await fetch('/api/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_id: exec.id, patient_id: exec.patient_id, phone: exec.patient.phone, message: msg, clinic_id: clinic?.id }),
    })
    setSending(null)
    setExecutions(prev => prev.map(e => e.id === exec.id ? { ...e, status: 'sent' } : e))
    setStats(s => ({ ...s, sent: s.sent + 1, pending: Math.max(0, s.pending - 1) }))
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const KPIs = [
    { label: 'Total',      value: stats.total,   icon: '📋', bg: 'bg-gray-100',   color: 'text-gray-700' },
    { label: 'Envoyés',    value: stats.sent,    icon: '✅', bg: 'bg-green-50',   color: 'text-green-700' },
    { label: 'En attente', value: stats.pending, icon: '⏳', bg: 'bg-amber-50',   color: 'text-amber-700' },
    { label: 'Échoués',    value: stats.failed,  icon: '❌', bg: 'bg-red-50',     color: 'text-red-600'   },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Automatisations</h1>
          <p className="text-sm text-gray-400 mt-0.5">Historique des envois automatiques</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIs.map(k => (
          <div key={k.label} className={`card p-4 ${k.bg}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {(['all','pending','sent','failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'all' ? 'Tous' : f === 'pending' ? '⏳ En attente' : f === 'sent' ? '✅ Envoyés' : '❌ Échoués'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-4xl mb-3">⚡</p>
          <p className="font-semibold text-gray-900 mb-1">Aucune automatisation</p>
          <p className="text-sm text-gray-400">Les automatisations apparaîtront ici au fur et à mesure des consultations</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Canal</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Message</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Planifié</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const type = TYPE_CONFIG[e.step?.type] ?? TYPE_CONFIG.whatsapp
                const status = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {e.patient?.first_name?.[0]}{e.patient?.last_name?.[0]}
                        </div>
                        <p className="text-sm font-medium text-gray-900">{e.patient?.first_name} {e.patient?.last_name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${type.bg} ${type.color}`}>
                        {type.icon} {type.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-xs text-gray-500 max-w-xs truncate">{e.step?.template_name || e.step?.template_body || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">{e.scheduled_at ? fmt(e.scheduled_at) : '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {e.status === 'pending' && e.step?.type === 'whatsapp' && (
                        <button onClick={() => send(e)} disabled={sending === e.id} className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50">
                          {sending === e.id ? '...' : '▶ Envoyer'}
                        </button>
                      )}
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
