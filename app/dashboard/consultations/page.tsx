'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function ConsultationsPage() {
  const supabase = createClient()
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'draft'|'completed'|'validated'>('all')

  const load = useCallback(async () => {
    let q = supabase.from('consultations')
      .select('*, patient:patients(first_name,last_name), treatment:treatments(name,color)')
      .order('consultation_date', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setConsultations(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const STATUS = {
    draft:     { label:'Brouillon',  color:'#D97706', bg:'#FFFBEB' },
    completed: { label:'Complétée', color:'#059669', bg:'#F0FDF4' },
    validated: { label:'Validée',   color:'#1D4ED8', bg:'#EFF6FF' },
  }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Consultations</div>
          <div className="page-subtitle">{consultations.length} consultation{consultations.length > 1 ? 's' : ''}</div>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration:'none', fontSize:13 }}>
          + Nouvelle consultation
        </Link>
      </div>

      <div className="page-content">
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {(['all','draft','completed','validated'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filter===f ? 'var(--blue)' : 'white', color: filter===f ? 'white' : 'var(--gray-600)', border: filter===f ? 'none' : '1px solid var(--gray-200)' }}>
              {f === 'all' ? 'Toutes' : STATUS[f].label}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : consultations.length === 0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✦</div>
              <div style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)', marginBottom:16 }}>Aucune consultation</div>
              <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration:'none', fontSize:13, display:'inline-flex' }}>
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
                {consultations.map((c: any) => {
                  const sc = STATUS[c.status as keyof typeof STATUS] ?? STATUS.draft
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div className="avatar" style={{ width:32, height:32, fontSize:11, fontWeight:700 }}>
                            {c.patient?.first_name?.[0]}{c.patient?.last_name?.[0]}
                          </div>
                          <span style={{ fontSize:14, fontWeight:500, color:'var(--gray-900)' }}>
                            {c.patient?.first_name} {c.patient?.last_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        {c.treatment ? (
                          <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:c.treatment.color, flexShrink:0 }} />
                            {c.treatment.name}
                          </span>
                        ) : <span style={{ color:'var(--gray-400)', fontSize:13 }}>—</span>}
                      </td>
                      <td style={{ fontSize:13, color:'var(--gray-600)' }}>{formatDateTime(c.consultation_date)}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:99, color:sc.color, background:sc.bg }}>
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        {c.transcription
                          ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99, color:'#6B21A8', background:'#FAF5FF' }}>🎙️ Transcrit</span>
                          : <span style={{ color:'var(--gray-300)', fontSize:12 }}>—</span>}
                      </td>
                      <td>
                        <Link href={`/dashboard/consultations/${c.id}`} style={{ color:'var(--blue)', fontSize:13, fontWeight:500, textDecoration:'none' }}>
                          Voir →
                        </Link>
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
