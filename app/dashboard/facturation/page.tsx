'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',  color: '#6B7280', bg: '#F3F4F6' },
  envoyee:    { label: 'Envoyée',    color: '#0891B2', bg: '#ECFEFF' },
  payee:      { label: '✓ Payée',    color: '#059669', bg: '#ECFDF5' },
  annulee:    { label: 'Annulée',    color: '#6B7280', bg: '#F3F4F6' },
  retard:     { label: '⚠ Retard',   color: '#DC2626', bg: '#FEF2F2' },
}

const MOYENS_PAIEMENT: Record<string, string> = {
  cb: '💳 CB', especes: '💵 Espèces', cheque: '📄 Chèque',
  virement: '🏦 Virement', autre: '📋 Autre',
}

export default function FacturationPage() {
  const supabase = createClient()
  const [factures, setFactures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [filter, setFilter] = useState<'all'|'brouillon'|'envoyee'|'payee'|'retard'>('all')
  const [toast, setToast] = useState<any>(null)
  const [markingPaid, setMarkingPaid] = useState<string|null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const { data } = await supabase.from('factures')
      .select('*, patient:patients(first_name, last_name, email)')
      .eq('clinic_id', prof.clinic_id)
      .order('created_at', { ascending: false })
    setFactures(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(id: string) {
    setMarkingPaid(id)
    await supabase.from('factures').update({
      status: 'payee',
      date_paiement: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    setFactures(prev => prev.map(f => f.id === id ? { ...f, status: 'payee', date_paiement: new Date().toISOString().split('T')[0] } : f))
    setMarkingPaid(null)
    showToast('✓ Facture marquée comme payée')
  }

  async function sendByEmail(facture: any) {
    if (!facture.patient?.email) { showToast('Pas d\'email pour ce patient', false); return }
    const res = await fetch('/api/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: facture.patient_id,
        subject: `Votre facture ${facture.numero}`,
        body: `Bonjour {{first_name}},\n\nVeuillez trouver ci-joint votre facture ${facture.numero} d'un montant de ${facture.total_ttc} € TTC.\n\nCordialement,\n{{clinic_name}}`,
      }),
    })
    const data = await res.json()
    if (data.success) {
      await supabase.from('factures').update({ status: 'envoyee' }).eq('id', facture.id)
      setFactures(prev => prev.map(f => f.id === facture.id ? { ...f, status: 'envoyee' } : f))
      showToast('✓ Facture envoyée par email')
    } else {
      showToast('Erreur envoi email', false)
    }
  }

  const filtered = filter === 'all' ? factures : factures.filter(f => f.status === filter)

  // Stats
  const caTotal = factures.filter(f => f.status === 'payee').reduce((s, f) => s + (f.total_ttc || 0), 0)
  const caEnAttente = factures.filter(f => ['envoyee','retard'].includes(f.status)).reduce((s, f) => s + (f.total_ttc || 0), 0)
  const nbRetard = factures.filter(f => f.status === 'retard').length

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Facturation</div>
          <div className="page-subtitle">Devis, factures et suivi des paiements</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/facturation/new" className="btn-primary" style={{ textDecoration:'none', fontSize:13 }}>
            + Nouvelle facture
          </Link>
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'CA encaissé', value: fmt(caTotal), color:'#059669', bg:'#ECFDF5', icon:'💰' },
            { label:'En attente', value: fmt(caEnAttente), color:'#0891B2', bg:'#ECFEFF', icon:'⏳' },
            { label:'Factures en retard', value: nbRetard.toString(), color:'#DC2626', bg:'#FEF2F2', icon:'⚠️' },
            { label:'Total factures', value: factures.length.toString(), color:'#6B7280', bg:'#F3F4F6', icon:'📄' },
          ].map(k => (
            <div key={k.label} className="stat-card" style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{k.icon}</div>
              <div>
                <div className="stat-value" style={{ fontSize:20, color:k.color }}>{k.value}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {(['all','envoyee','payee','retard','brouillon'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filter===f ? '#0F172A' : 'white', color: filter===f ? 'white' : 'var(--gray-600)', border: filter===f ? 'none' : '1px solid var(--gray-200)' }}>
              {f === 'all' ? `Toutes (${factures.length})` : `${STATUS_CFG[f].label} (${factures.filter(x => x.status===f).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💰</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>
              {filter === 'all' ? 'Aucune facture encore' : `Aucune facture "${STATUS_CFG[filter]?.label}"`}
            </div>
            <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:20 }}>Créez votre première facture depuis une consultation ou directement ici</div>
            <Link href="/dashboard/facturation/new" className="btn-primary" style={{ textDecoration:'none', fontSize:13 }}>+ Créer une facture</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Total HT</th>
                  <th>TVA</th>
                  <th>Total TTC</th>
                  <th>Statut</th>
                  <th>Paiement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const sc = STATUS_CFG[f.status]
                  return (
                    <tr key={f.id}>
                      <td>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--blue)', fontFamily:'monospace' }}>{f.numero}</span>
                        {f.type === 'avoir' && <span style={{ fontSize:10, background:'#FEF2F2', color:'#DC2626', padding:'1px 5px', borderRadius:3, marginLeft:6 }}>AVOIR</span>}
                      </td>
                      <td>
                        <div style={{ fontSize:13, fontWeight:500 }}>{f.patient?.first_name} {f.patient?.last_name}</div>
                        {f.patient?.email && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{f.patient.email}</div>}
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDate(f.date_emission)}</td>
                      <td style={{ fontSize:13, fontWeight:500 }}>{fmt(f.total_ht || 0)}</td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>{fmt(f.total_tva || 0)}</td>
                      <td style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)' }}>{fmt(f.total_ttc || 0)}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, color:sc.color, background:sc.bg, padding:'3px 9px', borderRadius:99 }}>{sc.label}</span></td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>
                        {f.moyen_paiement ? MOYENS_PAIEMENT[f.moyen_paiement] : '—'}
                        {f.date_paiement && <div style={{ fontSize:10 }}>{formatDate(f.date_paiement)}</div>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                          <Link href={`/api/factures/print?id=${f.id}`} target="_blank"
                            style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', color:'var(--gray-600)', textDecoration:'none' }}>
                            🖨️
                          </Link>
                          <button onClick={() => sendByEmail(f)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', color:'var(--blue)', cursor:'pointer' }}>
                            📧
                          </button>
                          {f.status !== 'payee' && f.status !== 'annulee' && (
                            <button onClick={() => markPaid(f.id)} disabled={markingPaid === f.id}
                              style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'none', background:'#ECFDF5', color:'#059669', cursor:'pointer', fontWeight:600 }}>
                              {markingPaid === f.id ? '...' : '✓ Payée'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
