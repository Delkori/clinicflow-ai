'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Ligne = {
  acte: string; code: string; quantite: number;
  prix_ht: number; tva_pct: number; prix_ttc: number;
}

export default function NouvelleFacturePage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <NouvelleFactureForm />
    </Suspense>
  )
}

function NouvelleFactureForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [patients, setPatients] = useState<any[]>([])
  const [actesCcam, setActesCcam] = useState<any[]>([])
  const [clinicId, setClinicId] = useState('')
  const [clinicName, setClinicName] = useState('')

  const [patientId, setPatientId] = useState(searchParams.get('patient_id') ?? '')
  const [searchPatient, setSearchPatient] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([
    { acte: '', code: '', quantite: 1, prix_ht: 0, tva_pct: 20, prix_ttc: 0 }
  ])
  const [notes, setNotes] = useState('')
  const [moyenPaiement, setMoyenPaiement] = useState('')
  const [paidNow, setPaidNow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id, clinic:clinics(name)').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      setClinicName((prof as any).clinic?.name ?? 'Ma Clinique')
      const [{ data: pts }, { data: actes }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name, email').order('last_name'),
        supabase.from('actes_ccam').select('*').order('categorie'),
      ])
      setPatients(pts ?? [])
      setActesCcam(actes ?? [])
    }
    load()
  }, [])

  function updateLigne(i: number, field: keyof Ligne, value: any) {
    const updated = [...lignes]
    updated[i] = { ...updated[i], [field]: value }
    // Recalculate TTC
    const prix_ht = field === 'prix_ht' ? +value : updated[i].prix_ht
    const tva_pct = field === 'tva_pct' ? +value : updated[i].tva_pct
    const quantite = field === 'quantite' ? +value : updated[i].quantite
    updated[i].prix_ttc = Math.round(prix_ht * quantite * (1 + tva_pct / 100) * 100) / 100
    setLignes(updated)
  }

  function selectActe(i: number, acteId: string) {
    const acte = actesCcam.find(a => a.id === acteId)
    if (!acte) return
    const updated = [...lignes]
    updated[i] = {
      acte: acte.libelle,
      code: acte.code,
      quantite: 1,
      prix_ht: acte.prix_convention ?? 0,
      tva_pct: acte.tva_pct ?? 20,
      prix_ttc: Math.round((acte.prix_convention ?? 0) * (1 + (acte.tva_pct ?? 20) / 100) * 100) / 100,
    }
    setLignes(updated)
  }

  function addLigne() {
    setLignes([...lignes, { acte: '', code: '', quantite: 1, prix_ht: 0, tva_pct: 20, prix_ttc: 0 }])
  }

  function removeLigne(i: number) {
    if (lignes.length === 1) return
    setLignes(lignes.filter((_, idx) => idx !== i))
  }

  const total_ht  = lignes.reduce((s, l) => s + (l.prix_ht * l.quantite), 0)
  const total_tva = lignes.reduce((s, l) => s + (l.prix_ht * l.quantite * l.tva_pct / 100), 0)
  const total_ttc = lignes.reduce((s, l) => s + l.prix_ttc, 0)
  const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

  const filteredPatients = patients.filter(p =>
    !searchPatient || `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchPatient.toLowerCase())
  )

  const selectedPatient = patients.find(p => p.id === patientId)

  async function handleSave() {
    if (!patientId || !clinicId) return
    setSaving(true)
    // Generate numero
    const year = new Date().getFullYear()
    const { count } = await supabase.from('factures').select('*', { count:'exact', head:true }).eq('clinic_id', clinicId)
    const numero = `FA-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`

    const { data: facture, error } = await supabase.from('factures').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      numero,
      type: 'facture',
      status: paidNow ? 'payee' : 'brouillon',
      lignes,
      total_ht: Math.round(total_ht * 100) / 100,
      total_tva: Math.round(total_tva * 100) / 100,
      total_ttc: Math.round(total_ttc * 100) / 100,
      tva_applicable: true,
      moyen_paiement: paidNow ? moyenPaiement || 'cb' : null,
      date_paiement: paidNow ? new Date().toISOString().split('T')[0] : null,
      notes: notes || null,
      mention_legale: 'Esthétique médicale non remboursée par l\'Assurance Maladie',
    }).select().single()

    setSaving(false)
    if (!error && facture) {
      router.push('/dashboard/facturation')
    }
  }

  const CATEGORIES_LABELS: Record<string, string> = {
    consultation: '🩺 Consultations',
    injections: '💉 Injections',
    laser: '⚡ Laser',
    peeling: '✨ Peeling',
    capillaire: '💈 Capillaire',
  }

  const groupedActes = actesCcam.reduce((acc, a) => {
    if (!acc[a.categorie]) acc[a.categorie] = []
    acc[a.categorie].push(a)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
            <Link href="/dashboard/facturation" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Facturation</Link> › Nouvelle facture
          </div>
          <div className="page-title">Nouvelle facture</div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth:900 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
          {/* Main form */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Patient */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:12 }}>👤 Patient</div>
              {selectedPatient ? (
                <div style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', background:'var(--blue-light)', borderRadius:10, border:'1px solid var(--blue-mid)' }}>
                  <div className="avatar" style={{ width:36, height:36 }}>{selectedPatient.first_name[0]}{selectedPatient.last_name[0]}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:'var(--gray-900)' }}>{selectedPatient.first_name} {selectedPatient.last_name}</div>
                    {selectedPatient.email && <div style={{ fontSize:12, color:'var(--gray-500)' }}>{selectedPatient.email}</div>}
                  </div>
                  <button onClick={() => setPatientId('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:18 }}>×</button>
                </div>
              ) : (
                <>
                  <input className="input" value={searchPatient} onChange={e => setSearchPatient(e.target.value)} placeholder="Rechercher un patient..." style={{ marginBottom:8 }} />
                  <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--gray-200)', borderRadius:9, overflow:'hidden' }}>
                    {filteredPatients.slice(0,8).map(p => (
                      <div key={p.id} onClick={() => { setPatientId(p.id); setSearchPatient('') }}
                        style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid var(--gray-50)', display:'flex', gap:8, alignItems:'center' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--gray-50)'}
                        onMouseLeave={e => e.currentTarget.style.background='white'}>
                        <div className="avatar" style={{ width:28, height:28, fontSize:10 }}>{p.first_name[0]}{p.last_name[0]}</div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500 }}>{p.first_name} {p.last_name}</div>
                          {p.email && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{p.email}</div>}
                        </div>
                      </div>
                    ))}
                    {filteredPatients.length === 0 && <div style={{ padding:16, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucun patient trouvé</div>}
                  </div>
                </>
              )}
            </div>

            {/* Lignes */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:14 }}>📋 Actes et prestations</div>

              {/* Header */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 70px 90px 30px', gap:8, marginBottom:8 }}>
                {['Acte / Prestation', 'Qté', 'Prix HT', 'TVA %', 'Prix TTC', ''].map(h => (
                  <div key={h} style={{ fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</div>
                ))}
              </div>

              {lignes.map((ligne, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 70px 90px 30px', gap:8, marginBottom:8, alignItems:'center' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <select className="input" style={{ fontSize:12 }} value=""
                      onChange={e => selectActe(i, e.target.value)}>
                      <option value="">Sélectionner un acte...</option>
                      {Object.entries(groupedActes).map(([cat, actes]) => (
                        <optgroup key={cat} label={CATEGORIES_LABELS[cat] ?? cat}>
                          {(actes as any[]).map(a => (
                            <option key={a.id} value={a.id}>{a.code} — {a.libelle} ({a.prix_convention}€)</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <input className="input" value={ligne.acte} onChange={e => updateLigne(i, 'acte', e.target.value)} placeholder="Ou saisir librement..." style={{ fontSize:12 }} />
                  </div>
                  <input className="input" type="number" value={ligne.quantite} min={1} onChange={e => updateLigne(i, 'quantite', e.target.value)} style={{ fontSize:12, textAlign:'center' }} />
                  <input className="input" type="number" value={ligne.prix_ht} step="0.01" onChange={e => updateLigne(i, 'prix_ht', e.target.value)} style={{ fontSize:12, textAlign:'right' }} />
                  <select className="input" value={ligne.tva_pct} onChange={e => updateLigne(i, 'tva_pct', e.target.value)} style={{ fontSize:12 }}>
                    <option value={0}>0%</option>
                    <option value={5.5}>5.5%</option>
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                  </select>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)', textAlign:'right' }}>{fmt(ligne.prix_ttc)}</div>
                  <button onClick={() => removeLigne(i)} disabled={lignes.length === 1}
                    style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor: lignes.length === 1 ? 'not-allowed' : 'pointer', color:'var(--gray-400)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    ×
                  </button>
                </div>
              ))}

              <button onClick={addLigne} style={{ fontSize:12, padding:'6px 12px', borderRadius:7, border:'1px dashed var(--gray-300)', background:'var(--gray-50)', cursor:'pointer', color:'var(--gray-600)', marginTop:4 }}>
                + Ajouter une ligne
              </button>
            </div>

            {/* Notes */}
            <div className="card" style={{ padding:20 }}>
              <label className="label">Notes / Conditions de paiement</label>
              <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ resize:'none' }} placeholder="Conditions de règlement à 30 jours..." />
            </div>
          </div>

          {/* Right — recap + totals */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Totals */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:14 }}>Récapitulatif</div>
              {[
                { label:'Total HT', value: fmt(total_ht) },
                { label:'TVA (20%)', value: fmt(total_tva) },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--gray-100)' }}>
                  <span style={{ fontSize:13, color:'var(--gray-600)' }}>{r.label}</span>
                  <span style={{ fontSize:13, fontWeight:500, color:'var(--gray-800)' }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', marginTop:4 }}>
                <span style={{ fontSize:15, fontWeight:700, color:'var(--gray-900)' }}>Total TTC</span>
                <span style={{ fontSize:20, fontWeight:800, color:'var(--blue)' }}>{fmt(total_ttc)}</span>
              </div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4, fontStyle:'italic' }}>
                Esthétique médicale non remboursée par l'Assurance Maladie
              </div>
            </div>

            {/* Paiement */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>Paiement</div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:12 }}>
                <input type="checkbox" checked={paidNow} onChange={e => setPaidNow(e.target.checked)} style={{ accentColor:'var(--green)' }} />
                <span style={{ fontSize:13, color:'var(--gray-700)' }}>Règlement effectué maintenant</span>
              </label>
              {paidNow && (
                <select className="input" value={moyenPaiement} onChange={e => setMoyenPaiement(e.target.value)} style={{ fontSize:13 }}>
                  <option value="">Moyen de paiement...</option>
                  <option value="cb">💳 Carte bancaire</option>
                  <option value="especes">💵 Espèces</option>
                  <option value="cheque">📄 Chèque</option>
                  <option value="virement">🏦 Virement</option>
                </select>
              )}
            </div>

            {/* Actions */}
            <button onClick={handleSave} disabled={saving || !patientId || lignes.every(l => !l.acte)}
              className="btn-primary" style={{ width:'100%', padding:14, fontSize:14, justifyContent:'center' }}>
              {saving ? 'Enregistrement...' : paidNow ? '💰 Enregistrer — Payée' : '📄 Créer la facture'}
            </button>
            <button onClick={() => router.back()} className="btn-secondary" style={{ width:'100%', justifyContent:'center', fontSize:13 }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
