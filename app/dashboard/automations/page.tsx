'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  email:    { icon: '📧', label: 'Email',     bg: 'var(--blue-light)',   color: 'var(--blue-dark)' },
  whatsapp: { icon: '💬', label: 'WhatsApp',  bg: 'var(--green-light)',  color: '#059669' },
  docusign: { icon: '✍️', label: 'DocuSign',  bg: 'var(--purple-light)', color: 'var(--purple)' },
  document: { icon: '📄', label: 'Document',  bg: 'var(--gray-100)',     color: 'var(--gray-600)' },
  sms:      { icon: '📱', label: 'SMS',       bg: '#FFFBEB',             color: '#D97706' },
}

export default function AutomationsPage() {
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all')
  const supabase = createClient()

  async function load() {
    let q = supabase.from('workflow_executions')
      .select('*, patient:patients(first_name, last_name), step:workflow_steps(type, template_name, timing_days, timing_reference), workflow:workflows(name)')
      .order('scheduled_at', { ascending: true })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setExecutions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function markAsSent(id: string) {
    await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', id)
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, status: 'sent' } : e))
  }

  const counts = { pending: 0, sent: 0, failed: 0, total: executions.length }
  executions.forEach(e => { if (e.status in counts) counts[e.status as keyof typeof counts]++ })

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Automatisations</div>
        <div className="page-subtitle">Suivi des actions automatisées du parcours patient</div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total', value: counts.total, bg: 'var(--gray-50)', color: 'var(--gray-900)', border: 'var(--gray-200)' },
            { label: 'En attente', value: executions.filter(e => e.status === 'pending').length, bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
            { label: 'Envoyées', value: executions.filter(e => e.status === 'sent').length, bg: 'var(--green-light)', color: '#059669', border: '#6EE7B7' },
            { label: 'Échouées', value: executions.filter(e => e.status === 'failed').length, bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: s.color, opacity: 0.7, marginTop: '2px', fontWeight: '500' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {(['all', 'pending', 'sent', 'failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              background: filter === f ? 'var(--blue)' : 'white',
              color: filter === f ? 'white' : 'var(--gray-600)',
              border: filter === f ? 'none' : '1px solid var(--gray-200)',
            }}>
              {f === 'all' ? 'Toutes' : f === 'pending' ? '⏳ En attente' : f === 'sent' ? '✅ Envoyées' : '❌ Échouées'}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : executions.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Aucune automatisation</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Action</th>
                  <th>Workflow</th>
                  <th>Planifié</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {executions.map((e: any) => {
                  const tc = TYPE_CONFIG[e.step?.type] ?? TYPE_CONFIG.document
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>
                            {e.patient?.first_name?.[0]}{e.patient?.last_name?.[0]}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>{e.patient?.first_name} {e.patient?.last_name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                            {tc.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: tc.color }}>{tc.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{e.step?.template_name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{e.workflow?.name}</td>
                      <td style={{ fontSize: '12px', color: 'var(--gray-600)' }}>{e.scheduled_at ? formatDateTime(e.scheduled_at) : '—'}</td>
                      <td>
                        <span className={`badge ${e.status === 'sent' ? 'badge-green' : e.status === 'failed' ? '' : 'badge-gray'}`}
                          style={e.status === 'failed' ? { background: '#FEF2F2', color: '#B91C1C' } : e.status === 'pending' ? { background: '#FFFBEB', color: '#D97706' } : {}}>
                          {e.status === 'sent' ? '✓ Envoyé' : e.status === 'failed' ? '✗ Échoué' : '⏳ En attente'}
                        </span>
                      </td>
                      <td>
                        {e.status === 'pending' && (
                          <button onClick={() => markAsSent(e.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', padding: '0' }}>
                            Marquer envoyé
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
