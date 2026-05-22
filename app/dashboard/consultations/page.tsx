'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'completed' | 'validated'>('all')
  const supabase = createClient()

  const load = useCallback(async () => {
    let q = supabase.from('consultations').select('*, patient:patients(first_name, last_name), treatment:treatments(name, color)').order('consultation_date', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setConsultations(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const statusBadge = (s: string) => {
    if (s === 'completed') return <span className="badge badge-green">Complétée</span>
    if (s === 'validated') return <span className="badge badge-blue">Validée</span>
    return <span className="badge badge-gray">Brouillon</span>
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Consultations</div>
          <div className="page-subtitle">{consultations.length} consultation{consultations.length > 1 ? 's' : ''}</div>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          + Nouvelle consultation
        </Link>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {(['all', 'draft', 'completed', 'validated'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              background: filter === f ? 'var(--blue)' : 'white',
              color: filter === f ? 'white' : 'var(--gray-600)',
              border: filter === f ? 'none' : '1px solid var(--gray-200)',
            }}>
              {f === 'all' ? 'Toutes' : f === 'draft' ? 'Brouillons' : f === 'completed' ? 'Complétées' : 'Validées'}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : consultations.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✦</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '6px' }}>Aucune consultation</div>
              <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', marginTop: '12px' }}>
                + Créer la première
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Traitement</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>IA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '11px' }}>
                          {c.patient?.first_name?.[0]}{c.patient?.last_name?.[0]}
                        </div>
                        <span style={{ fontWeight: '500', fontSize: '14px' }}>{c.patient?.first_name} {c.patient?.last_name}</span>
                      </div>
                    </td>
                    <td>
                      {c.treatment ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.treatment.color, flexShrink: 0 }} />
                          {c.treatment.name}
                        </span>
                      ) : <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--gray-600)' }}>{formatDateTime(c.consultation_date)}</td>
                    <td>{statusBadge(c.status)}</td>
                    <td>
                      {c.transcription
                        ? <span className="badge badge-purple">🎙️ Transcrit</span>
                        : <span style={{ color: 'var(--gray-300)', fontSize: '12px' }}>—</span>}
                    </td>
                    <td><Link href={`/dashboard/consultations/${c.id}`} style={{ color: 'var(--blue)', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Voir →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
