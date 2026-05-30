'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const CATEGORIES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  injectables:  { label: 'Injectables',   icon: '💉', color: '#7C3AED', bg: '#F5F3FF' },
  consommables: { label: 'Consommables',  icon: '📦', color: '#0891B2', bg: '#ECFEFF' },
  materiel:     { label: 'Matériel',      icon: '🔧', color: '#475569', bg: '#F8FAFC' },
  cosmetiques:  { label: 'Cosmétiques',   icon: '✨', color: '#EC4899', bg: '#FFF0F7' },
  autre:        { label: 'Autre',         icon: '📋', color: '#6B7280', bg: '#F3F4F6' },
}

export default function StocksPage() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [mouvements, setMouvements] = useState<any[]>([])
  const [clinicId, setClinicId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stocks'|'mouvements'|'alertes'>('stocks')
  const [filterCat, setFilterCat] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [showMvt, setShowMvt] = useState<any>(null)
  const [toast, setToast] = useState<any>(null)

  // Forms
  const [newItem, setNewItem] = useState({ nom:'', categorie:'injectables', fournisseur:'', unite:'flacon', stock_actuel:0, stock_minimum:2, prix_achat:0, prix_vente:0 })
  const [mvtForm, setMvtForm] = useState({ type:'sortie', quantite:1, motif:'' })
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data: itms }, { data: mvts }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('clinic_id', prof.clinic_id).eq('is_active', true).order('categorie').order('nom'),
      supabase.from('stock_mouvements').select('*, item:stock_items(nom, unite), patient:patients(first_name,last_name)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }).limit(50),
    ])
    setItems(itms ?? [])
    setMouvements(mvts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveNewItem() {
    if (!newItem.nom || !clinicId) return
    setSaving(true)
    const { error } = await supabase.from('stock_items').insert({ clinic_id: clinicId, ...newItem })
    setSaving(false)
    if (!error) { showToast('✓ Article ajouté'); setShowNew(false); setNewItem({ nom:'', categorie:'injectables', fournisseur:'', unite:'flacon', stock_actuel:0, stock_minimum:2, prix_achat:0, prix_vente:0 }); load() }
    else showToast(error.message, false)
  }

  async function saveMouvement() {
    if (!showMvt || !clinicId) return
    setSaving(true)
    const item = items.find(i => i.id === showMvt.id)
    if (!item) return
    const qte = +mvtForm.quantite
    const stock_avant = item.stock_actuel
    const stock_apres = mvtForm.type === 'entree' ? stock_avant + qte : stock_avant - qte
    await supabase.from('stock_mouvements').insert({
      clinic_id: clinicId, item_id: item.id,
      type: mvtForm.type, quantite: qte,
      stock_avant, stock_apres, motif: mvtForm.motif || null,
    })
    await supabase.from('stock_items').update({ stock_actuel: stock_apres }).eq('id', item.id)
    setSaving(false)
    showToast(`✓ Stock mis à jour : ${stock_apres} ${item.unite}`)
    setShowMvt(null)
    setMvtForm({ type:'sortie', quantite:1, motif:'' })
    load()
  }

  const filtered = filterCat === 'all' ? items : items.filter(i => i.categorie === filterCat)
  const alerts = items.filter(i => i.stock_actuel <= i.stock_minimum)
  const totalValue = items.reduce((s, i) => s + (i.stock_actuel * (i.prix_achat || 0)), 0)
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' €'

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Gestion des stocks</div>
          <div className="page-subtitle">{items.length} articles · {fmt(totalValue)} de valeur · {alerts.length > 0 ? `⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}` : '✓ Tous les stocks OK'}</div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Ajouter un article</button>
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 28px', display:'flex', gap:0 }}>
        {([['stocks',`📦 Articles (${items.length})`],['alertes',`⚠️ Alertes (${alerts.length})`],['mouvements','📋 Mouvements']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {/* Category filters */}
        {tab === 'stocks' && (
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            <button onClick={() => setFilterCat('all')} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filterCat==='all' ? '#0F172A' : 'white', color: filterCat==='all' ? 'white' : 'var(--gray-600)', border: filterCat==='all' ? 'none' : '1px solid var(--gray-200)' }}>
              Tous ({items.length})
            </button>
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const count = items.filter(i => i.categorie === key).length
              if (count === 0) return null
              return (
                <button key={key} onClick={() => setFilterCat(key)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filterCat===key ? cat.color : 'white', color: filterCat===key ? 'white' : cat.color, border: filterCat===key ? 'none' : `1px solid ${cat.bg}`, outline: `1px solid ${filterCat===key ? 'transparent' : cat.bg}` }}>
                  {cat.icon} {cat.label} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* STOCKS TAB */}
        {tab === 'stocks' && (
          loading ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div> :
          filtered.length === 0 ? (
            <div className="card" style={{ padding:48, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucun article dans cette catégorie</div>
              <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Ajouter un article</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Catégorie</th>
                    <th>Fournisseur</th>
                    <th>Stock actuel</th>
                    <th>Seuil min</th>
                    <th>Prix achat</th>
                    <th>Valeur stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const cat = CATEGORIES[item.categorie] ?? CATEGORIES.autre
                    const isLow = item.stock_actuel <= item.stock_minimum
                    const stockPct = item.stock_minimum > 0 ? Math.min(100, (item.stock_actuel / (item.stock_minimum * 3)) * 100) : 50
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight:600, color:'var(--gray-900)', fontSize:13 }}>{item.nom}</div>
                          {item.reference && <div style={{ fontSize:11, color:'var(--gray-400)' }}>Réf: {item.reference}</div>}
                        </td>
                        <td>
                          <span style={{ fontSize:11, fontWeight:600, color:cat.color, background:cat.bg, padding:'2px 8px', borderRadius:99 }}>{cat.icon} {cat.label}</span>
                        </td>
                        <td style={{ fontSize:12, color:'var(--gray-600)' }}>{item.fournisseur || '—'}</td>
                        <td>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:14, fontWeight:700, color: isLow ? '#DC2626' : 'var(--gray-900)' }}>{item.stock_actuel}</span>
                              <span style={{ fontSize:11, color:'var(--gray-400)' }}>{item.unite}</span>
                              {isLow && <span style={{ fontSize:10, background:'#FEF2F2', color:'#DC2626', padding:'1px 6px', borderRadius:99, fontWeight:700 }}>⚠ BAS</span>}
                            </div>
                            <div style={{ height:4, background:'var(--gray-100)', borderRadius:99, overflow:'hidden', width:80 }}>
                              <div style={{ height:'100%', width:`${stockPct}%`, background: isLow ? '#EF4444' : stockPct < 60 ? '#F59E0B' : '#10B981', borderRadius:99 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize:12, color:'var(--gray-500)' }}>{item.stock_minimum} {item.unite}</td>
                        <td style={{ fontSize:12, color:'var(--gray-600)' }}>{item.prix_achat ? `${item.prix_achat} €` : '—'}</td>
                        <td style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>
                          {item.prix_achat ? `${(item.stock_actuel * item.prix_achat).toFixed(0)} €` : '—'}
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:5 }}>
                            <button onClick={() => { setShowMvt(item); setMvtForm({ type:'entree', quantite:1, motif:'' }) }}
                              style={{ fontSize:11, padding:'4px 9px', borderRadius:6, border:'1px solid #BBF7D0', background:'#ECFDF5', color:'#059669', cursor:'pointer', fontWeight:600 }}>
                              + Entrée
                            </button>
                            <button onClick={() => { setShowMvt(item); setMvtForm({ type:'sortie', quantite:1, motif:'' }) }}
                              style={{ fontSize:11, padding:'4px 9px', borderRadius:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontWeight:600 }}>
                              − Sortie
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ALERTES TAB */}
        {tab === 'alertes' && (
          alerts.length === 0 ? (
            <div className="card" style={{ padding:48, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:15, fontWeight:600, color:'#059669', marginBottom:4 }}>Tous les stocks sont OK</div>
              <div style={{ fontSize:13, color:'var(--gray-500)' }}>Aucun article n'est en dessous du seuil minimum</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {alerts.map(item => {
                const cat = CATEGORIES[item.categorie] ?? CATEGORIES.autre
                const urgence = item.stock_actuel === 0 ? 'Rupture' : 'Stock bas'
                return (
                  <div key={item.id} className="card" style={{ padding:'16px 20px', borderLeft:`4px solid ${item.stock_actuel === 0 ? '#DC2626' : '#F59E0B'}`, display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ width:42, height:42, borderRadius:10, background: item.stock_actuel === 0 ? '#FEF2F2' : '#FFFBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {item.stock_actuel === 0 ? '🚨' : '⚠️'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{item.nom}</span>
                        <span style={{ fontSize:11, fontWeight:700, color: item.stock_actuel === 0 ? '#DC2626' : '#D97706', background: item.stock_actuel === 0 ? '#FEF2F2' : '#FFFBEB', padding:'1px 7px', borderRadius:99 }}>{urgence}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:cat.color, background:cat.bg, padding:'1px 7px', borderRadius:99 }}>{cat.icon} {cat.label}</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--gray-500)' }}>
                        Stock actuel : <strong style={{ color: item.stock_actuel === 0 ? '#DC2626' : '#D97706' }}>{item.stock_actuel} {item.unite}</strong>
                        {' '}· Seuil minimum : {item.stock_minimum} {item.unite}
                        {item.fournisseur && ` · Fournisseur : ${item.fournisseur}`}
                      </div>
                    </div>
                    <button onClick={() => { setShowMvt(item); setMvtForm({ type:'entree', quantite: item.stock_minimum * 2, motif:'Réapprovisionnement' }) }}
                      className="btn-primary" style={{ fontSize:12, flexShrink:0 }}>
                      + Commander
                    </button>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* MOUVEMENTS TAB */}
        {tab === 'mouvements' && (
          mouvements.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              Aucun mouvement de stock enregistré
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Article</th><th>Type</th><th>Quantité</th><th>Avant → Après</th><th>Motif</th><th>Date</th></tr></thead>
                <tbody>
                  {mouvements.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight:500, fontSize:13 }}>{m.item?.nom}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, color: m.type==='entree' ? '#059669' : m.type==='sortie' ? '#DC2626' : '#D97706', background: m.type==='entree' ? '#ECFDF5' : m.type==='sortie' ? '#FEF2F2' : '#FFFBEB', padding:'2px 8px', borderRadius:99 }}>
                          {m.type==='entree' ? '↑ Entrée' : m.type==='sortie' ? '↓ Sortie' : m.type==='ajustement' ? '⟳ Ajust.' : '⚠ Pér.'}
                        </span>
                      </td>
                      <td style={{ fontSize:13, fontWeight:600, color: m.type==='entree' ? '#059669' : '#DC2626' }}>
                        {m.type==='entree' ? '+' : '-'}{m.quantite} {m.item?.unite}
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-500)', fontFamily:'monospace' }}>
                        {m.stock_avant} → {m.stock_apres}
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-600)' }}>{m.motif || '—'}</td>
                      <td style={{ fontSize:11, color:'var(--gray-500)' }}>{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Modal nouveau article */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title">📦 Nouvel article</div>
              <button onClick={() => setShowNew(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="label">Nom *</label><input className="input" value={newItem.nom} onChange={e => setNewItem(f => ({ ...f, nom: e.target.value }))} placeholder="Juvederm Ultra 2..." /></div>
                <div><label className="label">Catégorie</label>
                  <select className="input" value={newItem.categorie} onChange={e => setNewItem(f => ({ ...f, categorie: e.target.value }))}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Unité</label><input className="input" value={newItem.unite} onChange={e => setNewItem(f => ({ ...f, unite: e.target.value }))} placeholder="flacon, boite..." /></div>
                <div><label className="label">Fournisseur</label><input className="input" value={newItem.fournisseur} onChange={e => setNewItem(f => ({ ...f, fournisseur: e.target.value }))} placeholder="Allergan..." /></div>
                <div><label className="label">Stock initial</label><input className="input" type="number" value={newItem.stock_actuel} onChange={e => setNewItem(f => ({ ...f, stock_actuel: +e.target.value }))} /></div>
                <div><label className="label">Seuil minimum</label><input className="input" type="number" value={newItem.stock_minimum} onChange={e => setNewItem(f => ({ ...f, stock_minimum: +e.target.value }))} /></div>
                <div><label className="label">Prix d'achat (€)</label><input className="input" type="number" step="0.01" value={newItem.prix_achat} onChange={e => setNewItem(f => ({ ...f, prix_achat: +e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
              <button onClick={saveNewItem} disabled={saving || !newItem.nom} className="btn-primary">{saving ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mouvement */}
      {showMvt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">{mvtForm.type === 'entree' ? '↑ Entrée' : '↓ Sortie'} — {showMvt.nom}</div>
              <button onClick={() => setShowMvt(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', gap:8 }}>
                {(['entree','sortie','ajustement'] as const).map(t => (
                  <button key={t} onClick={() => setMvtForm(f => ({ ...f, type: t }))}
                    style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${mvtForm.type===t ? (t==='entree'?'#059669':t==='sortie'?'#DC2626':'#D97706') : 'var(--gray-200)'}`, background: mvtForm.type===t ? (t==='entree'?'#ECFDF5':t==='sortie'?'#FEF2F2':'#FFFBEB') : 'white', fontSize:12, fontWeight:600, color: mvtForm.type===t ? (t==='entree'?'#059669':t==='sortie'?'#DC2626':'#D97706') : 'var(--gray-500)' }}>
                    {t==='entree'?'↑ Entrée':t==='sortie'?'↓ Sortie':'⟳ Ajustement'}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Quantité ({showMvt.unite})</label>
                <input className="input" type="number" step="0.5" min="0" value={mvtForm.quantite} onChange={e => setMvtForm(f => ({ ...f, quantite: +e.target.value }))} />
                <div style={{ fontSize:11, color:'var(--gray-500)', marginTop:4 }}>
                  Stock actuel : {showMvt.stock_actuel} → {mvtForm.type === 'entree' ? showMvt.stock_actuel + mvtForm.quantite : showMvt.stock_actuel - mvtForm.quantite} {showMvt.unite}
                </div>
              </div>
              <div><label className="label">Motif</label><input className="input" value={mvtForm.motif} onChange={e => setMvtForm(f => ({ ...f, motif: e.target.value }))} placeholder="Utilisation consultation, réapprovisionnement..." /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMvt(null)} className="btn-secondary">Annuler</button>
              <button onClick={saveMouvement} disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
