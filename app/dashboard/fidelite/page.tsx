'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const TIERS = {
  bronze:   { label: 'Bronze',   color: '#92400E', bg: '#FEF3C7', min: 0,    icon: '🥉' },
  silver:   { label: 'Silver',   color: '#475569', bg: '#F1F5F9', min: 500,  icon: '🥈' },
  gold:     { label: 'Gold',     color: '#D97706', bg: '#FFFBEB', min: 1500, icon: '🥇' },
  platinum: { label: 'Platinum', color: '#7C3AED', bg: '#F5F3FF', min: 5000, icon: '💎' },
}

export default function FidelitePage() {
  const supabase = createClient()
  const [program, setProgram] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [clinicId, setClinicId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'membres'|'transactions'|'config'>('membres')
  const [showAward, setShowAward] = useState<any>(null)
  const [awardForm, setAwardForm] = useState({ points: 0, description: '' })
  const [toast, setToast] = useState<any>(null)
  const [searchPat, setSearchPat] = useState('')
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data: prog }, { data: accs }, { data: txs }] = await Promise.all([
      supabase.from('loyalty_programs').select('*').eq('clinic_id', prof.clinic_id).single(),
      supabase.from('loyalty_accounts').select('*, patient:patients(first_name,last_name,email,phone)').eq('clinic_id', prof.clinic_id).order('points_total', { ascending: false }),
      supabase.from('loyalty_transactions').select('*, patient:patients(first_name,last_name)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }).limit(50),
    ])
    setProgram(prog)
    setAccounts(accs ?? [])
    setTransactions(txs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function awardPoints() {
    if (!showAward || !clinicId || !awardForm.points) return
    setSaving(true)
    const acc = accounts.find(a => a.patient_id === showAward.patient_id)
    if (!acc) { setSaving(false); showToast('Compte fidélité introuvable', false); return }

    const newTotal = acc.points_total + awardForm.points
    const newTier = newTotal >= TIERS.platinum.min ? 'platinum' : newTotal >= TIERS.gold.min ? 'gold' : newTotal >= TIERS.silver.min ? 'silver' : 'bronze'

    await supabase.from('loyalty_transactions').insert({
      clinic_id: clinicId, patient_id: acc.patient_id, account_id: acc.id,
      type: 'bonus', points: awardForm.points, description: awardForm.description || 'Points ajoutés manuellement',
    })
    await supabase.from('loyalty_accounts').update({ points_total: newTotal, tier: newTier }).eq('id', acc.id)
    setSaving(false)
    showToast(`✓ +${awardForm.points} points attribués`)
    setShowAward(null)
    setAwardForm({ points: 0, description: '' })
    load()
  }

  const getTier = (points: number) =>
    points >= TIERS.platinum.min ? 'platinum' : points >= TIERS.gold.min ? 'gold' : points >= TIERS.silver.min ? 'silver' : 'bronze'

  const getNextTier = (points: number) => {
    if (points >= TIERS.platinum.min) return null
    if (points >= TIERS.gold.min) return { name: 'Platinum', needed: TIERS.platinum.min - points }
    if (points >= TIERS.silver.min) return { name: 'Gold', needed: TIERS.gold.min - points }
    return { name: 'Silver', needed: TIERS.silver.min - points }
  }

  const filtered = accounts.filter(a => !searchPat || `${a.patient?.first_name} ${a.patient?.last_name}`.toLowerCase().includes(searchPat.toLowerCase()))
  const totalPoints = accounts.reduce((s, a) => s + a.points_total, 0)
  const activeMembers = accounts.filter(a => a.points_total > 0).length

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Programme de fidélité</div>
          <div className="page-subtitle">{activeMembers} membres actifs · {totalPoints.toLocaleString('fr-FR')} points distribués</div>
        </div>
      </div>

      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 28px' }}>
        {([['membres','👥 Membres'],['transactions','📋 Transactions'],['config','⚙️ Configuration']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {Object.entries(TIERS).map(([key, tier]) => {
            const count = accounts.filter(a => a.tier === key || getTier(a.points_total) === key).length
            return (
              <div key={key} className="stat-card" style={{ borderTop:`3px solid ${tier.color}` }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{tier.icon}</div>
                <div className="stat-value" style={{ color:tier.color }}>{count}</div>
                <div className="stat-label">Membres {tier.label}</div>
              </div>
            )
          })}
        </div>

        {/* MEMBRES TAB */}
        {tab === 'membres' && (
          <>
            <input className="input" value={searchPat} onChange={e => setSearchPat(e.target.value)} placeholder="Rechercher un patient..." style={{ marginBottom:12, maxWidth:360 }} />
            {filtered.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🎁</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucun membre encore</div>
                <div style={{ fontSize:13, color:'var(--gray-500)' }}>Les patients accumulent des points automatiquement lors de leurs achats</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Statut</th><th>Points</th><th>Points utilisés</th><th>Valeur (€)</th><th>Prochain palier</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map(acc => {
                      const tier = TIERS[acc.tier as keyof typeof TIERS] ?? TIERS.bronze
                      const next = getNextTier(acc.points_total)
                      const valeur = ((acc.points_total - acc.points_used) * (program?.euro_per_point ?? 0.01)).toFixed(2)
                      return (
                        <tr key={acc.id}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div className="avatar" style={{ width:32, height:32, fontSize:11 }}>{acc.patient?.first_name?.[0]}{acc.patient?.last_name?.[0]}</div>
                              <div>
                                <div style={{ fontWeight:500, fontSize:13 }}>{acc.patient?.first_name} {acc.patient?.last_name}</div>
                                {acc.patient?.email && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{acc.patient.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize:12, fontWeight:700, color:tier.color, background:tier.bg, padding:'3px 10px', borderRadius:99 }}>
                              {tier.icon} {tier.label}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize:15, fontWeight:800, color:'var(--gray-900)' }}>{(acc.points_total - acc.points_used).toLocaleString('fr-FR')}</span>
                            <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:4 }}>pts</span>
                          </td>
                          <td style={{ fontSize:12, color:'var(--gray-500)' }}>{acc.points_used.toLocaleString('fr-FR')} pts</td>
                          <td style={{ fontSize:13, fontWeight:600, color:'#059669' }}>{valeur} €</td>
                          <td>
                            {next ? (
                              <div style={{ fontSize:11, color:'var(--gray-500)' }}>
                                <div>{next.needed} pts pour {next.name}</div>
                                <div style={{ height:4, background:'var(--gray-100)', borderRadius:99, marginTop:3, width:100 }}>
                                  <div style={{ height:'100%', width:`${Math.min(100, 100 - (next.needed / (TIERS[next.name.toLowerCase() as keyof typeof TIERS]?.min ?? 1) * 100))}%`, background:'var(--blue)', borderRadius:99 }} />
                                </div>
                              </div>
                            ) : <span style={{ fontSize:11, color:'#7C3AED' }}>💎 Niveau max</span>}
                          </td>
                          <td>
                            <button onClick={() => setShowAward(acc)} style={{ fontSize:11, padding:'4px 9px', borderRadius:6, border:'1px solid var(--blue-mid)', background:'var(--blue-light)', color:'var(--blue-dark)', cursor:'pointer', fontWeight:600 }}>
                              + Points
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === 'transactions' && (
          <div className="table-wrap">
            {transactions.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucune transaction</div>
            ) : (
              <table>
                <thead><tr><th>Patient</th><th>Type</th><th>Points</th><th>Description</th><th>Date</th></tr></thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight:500, fontSize:13 }}>{tx.patient?.first_name} {tx.patient?.last_name}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, color: tx.type==='earn'||tx.type==='bonus' ? '#059669' : '#DC2626', background: tx.type==='earn'||tx.type==='bonus' ? '#ECFDF5' : '#FEF2F2', padding:'2px 7px', borderRadius:99 }}>
                          {tx.type === 'earn' ? '+ Gains' : tx.type === 'bonus' ? '+ Bonus' : tx.type === 'redeem' ? '− Échange' : '⟳ Ajust.'}
                        </span>
                      </td>
                      <td style={{ fontSize:14, fontWeight:700, color: tx.points > 0 ? '#059669' : '#DC2626' }}>
                        {tx.points > 0 ? '+' : ''}{tx.points} pts
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-600)' }}>{tx.description || '—'}</td>
                      <td style={{ fontSize:11, color:'var(--gray-500)' }}>{formatDate(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CONFIG TAB */}
        {tab === 'config' && (
          <div style={{ maxWidth:560 }}>
            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-800)', marginBottom:16 }}>⚙️ Paramètres du programme</div>
              {program ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { label:'Points par euro dépensé', value:`${program.points_per_euro} pt`, desc:'1 pt par euro = standard' },
                    { label:'Valeur d\'un point', value:`${program.euro_per_point} €`, desc:`100 pts = ${(100 * program.euro_per_point).toFixed(2)} €` },
                    { label:'Minimum pour échanger', value:`${program.min_redeem_points} pts`, desc:`Soit ${(program.min_redeem_points * program.euro_per_point).toFixed(2)} €` },
                    { label:'Bonus de bienvenue', value:`${program.welcome_bonus} pts`, desc:`Offerts à la création du compte` },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-100)' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)' }}>{item.label}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)' }}>{item.desc}</div>
                      </div>
                      <span style={{ fontSize:15, fontWeight:700, color:'var(--blue)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:13, color:'var(--gray-500)', textAlign:'center', padding:20 }}>Programme non configuré</div>
              )}
            </div>

            <div className="card" style={{ padding:20, background:'var(--gray-50)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', marginBottom:10 }}>Paliers de fidélité</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {Object.entries(TIERS).map(([key, tier]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'white', borderRadius:9, border:`1px solid ${tier.bg}` }}>
                    <span style={{ fontSize:20 }}>{tier.icon}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:tier.color }}>{tier.label}</span>
                    </div>
                    <span style={{ fontSize:12, color:'var(--gray-500)' }}>
                      {tier.min === 0 ? 'Dès le départ' : `À partir de ${tier.min.toLocaleString('fr-FR')} pts`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal attribution points */}
      {showAward && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">🎁 Attribuer des points</div>
              <button onClick={() => setShowAward(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ padding:'10px 14px', background:'var(--blue-light)', borderRadius:9, fontSize:13, color:'var(--blue-dark)', fontWeight:500 }}>
                {showAward.patient?.first_name} {showAward.patient?.last_name} — {(showAward.points_total - showAward.points_used).toLocaleString('fr-FR')} pts actuels
              </div>
              <div><label className="label">Nombre de points *</label><input className="input" type="number" min="1" value={awardForm.points} onChange={e => setAwardForm(f => ({ ...f, points: +e.target.value }))} placeholder="50" /></div>
              <div><label className="label">Description</label><input className="input" value={awardForm.description} onChange={e => setAwardForm(f => ({ ...f, description: e.target.value }))} placeholder="Bonus fidélité, anniversaire..." /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAward(null)} className="btn-secondary">Annuler</button>
              <button onClick={awardPoints} disabled={saving || !awardForm.points} className="btn-primary">{saving ? '...' : `Attribuer ${awardForm.points} pts`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
