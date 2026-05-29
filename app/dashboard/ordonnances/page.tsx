'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const MEDICAMENTS_COMMUNS = [
  { nom: 'Crème EMLA 5%', dosage: 'Tube 30g', posologie: 'Appliquer 1h avant le soin sous film occlusif', duree: '1 application' },
  { nom: 'Ibuprofène 400mg', dosage: '400mg', posologie: '1 comprimé 3x/jour pendant les repas', duree: '3 à 5 jours' },
  { nom: 'Paracétamol 1g', dosage: '1g', posologie: '1 comprimé 3 à 4x/jour maximum', duree: '5 jours' },
  { nom: 'Amoxicilline 1g', dosage: '1g', posologie: '1 comprimé 3x/jour', duree: '7 jours' },
  { nom: 'Augmentin 1g', dosage: '1g', posologie: '1 comprimé 3x/jour pendant les repas', duree: '7 jours' },
  { nom: 'Azithromycine 500mg', dosage: '500mg', posologie: '1 comprimé/jour', duree: '3 jours' },
  { nom: 'Prednisolone 20mg', dosage: '20mg', posologie: 'Selon prescription', duree: 'Selon prescription' },
  { nom: 'Cicaplast Baume B5+', dosage: 'Tube 100ml', posologie: 'Appliquer généreusement sur la zone traitée 2x/jour', duree: '10 jours' },
  { nom: 'Cicalfate Crème', dosage: 'Tube 40g', posologie: 'Appliquer 2x/jour sur la zone traitée', duree: '7 jours' },
  { nom: 'SPF 50+ (Altrix)', dosage: 'Flacon 100ml', posologie: 'Appliquer toutes les 2h sur la zone traitée', duree: '30 jours' },
  { nom: 'Minoxidil 5% solution', dosage: '60ml', posologie: '1ml 2x/jour sur le cuir chevelu sec', duree: 'Long terme' },
  { nom: 'Finastéride 1mg', dosage: '1mg', posologie: '1 comprimé/jour', duree: 'Long terme' },
]

type Ligne = { medicament: string; dosage: string; posologie: string; duree: string; renouvellement: boolean }

export default function OrdonnancesPage() {
  const supabase = createClient()
  const [ordonnances, setOrdonnances] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState<string|null>(null)
  const [toast, setToast] = useState<any>(null)

  // New ordonnance form
  const [patientId, setPatientId] = useState('')
  const [searchPat, setSearchPat] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([{ medicament:'', dosage:'', posologie:'', duree:'', renouvellement:false }])
  const [instructions, setInstructions] = useState('')
  const [type, setType] = useState('medicaments')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('*, clinic:clinics(name)').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    setClinicName((prof as any).clinic?.name ?? 'Ma Clinique')
    setDoctorName(prof.full_name ?? 'Dr.')
    const [{ data: ordo }, { data: pts }] = await Promise.all([
      supabase.from('ordonnances').select('*, patient:patients(first_name, last_name)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }),
      supabase.from('patients').select('id, first_name, last_name').order('last_name'),
    ])
    setOrdonnances(ordo ?? [])
    setPatients(pts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function addLigne() {
    setLignes([...lignes, { medicament:'', dosage:'', posologie:'', duree:'', renouvellement:false }])
  }

  function updateLigne(i: number, field: keyof Ligne, value: any) {
    const updated = [...lignes]
    updated[i] = { ...updated[i], [field]: value }
    setLignes(updated)
  }

  function selectMedicament(i: number, med: typeof MEDICAMENTS_COMMUNS[0]) {
    const updated = [...lignes]
    updated[i] = { ...updated[i], medicament: med.nom, dosage: med.dosage, posologie: med.posologie, duree: med.duree }
    setLignes(updated)
  }

  async function handleSave() {
    if (!patientId || !clinicId) return
    setSaving(true)
    const year = new Date().getFullYear()
    const { count } = await supabase.from('ordonnances').select('*', { count:'exact', head:true }).eq('clinic_id', clinicId)
    const numero = `ORD-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`
    const { error } = await supabase.from('ordonnances').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      numero,
      type,
      lignes: lignes.filter(l => l.medicament),
      instructions: instructions || null,
    })
    setSaving(false)
    if (!error) {
      showToast('✓ Ordonnance créée')
      setShowNew(false)
      setPatientId(''); setLignes([{ medicament:'', dosage:'', posologie:'', duree:'', renouvellement:false }])
      setInstructions('')
      load()
    }
  }

  function printOrdonnance(ordo: any) {
    const patient = ordo.patient
    const lignesHtml = (ordo.lignes ?? []).map((l: any) => `
      <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f1f5f9">
        <div style="font-weight:600;font-size:14px">${l.medicament} ${l.dosage}</div>
        <div style="font-size:13px;color:#374151;margin-top:3px">${l.posologie}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">Durée : ${l.duree}${l.renouvellement ? ' · Renouvelable' : ''}</div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Ordonnance ${ordo.numero}</title>
    <style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:600px;margin:0 auto;color:#111}
    @media print{.no-print{display:none}}</style></head><body>
    <div style="display:flex;justify-content:space-between;padding-bottom:20px;border-bottom:2px solid #0f172a;margin-bottom:24px">
      <div><div style="font-size:18px;font-weight:700">${clinicName}</div><div style="font-size:12px;color:#64748b">Ordonnance médicale</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:600">${doctorName}</div><div style="font-size:12px;color:#64748b">${new Date().toLocaleDateString('fr-FR')}</div></div>
    </div>
    <div style="background:#f8fafc;padding:14px;border-radius:8px;margin-bottom:20px">
      <div style="font-weight:600">${patient?.first_name} ${patient?.last_name}</div>
      <div style="font-size:12px;color:#6b7280">N° ${ordo.numero}</div>
    </div>
    ${lignesHtml}
    ${ordo.instructions ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:13px;color:#92400e"><strong>Instructions :</strong><br>${ordo.instructions}</div>` : ''}
    <div style="margin-top:40px;display:flex;justify-content:flex-end">
      <div style="text-align:center"><div style="width:120px;height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:5px"></div><div style="font-size:11px;color:#9ca3af">Signature et cachet</div></div>
    </div>
    <div class="no-print" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:10px 24px;background:#0f172a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimer</button></div>
    </body></html>`

    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
  }

  const filteredPats = patients.filter(p => !searchPat || `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchPat.toLowerCase()))
  const selectedPat = patients.find(p => p.id === patientId)

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Ordonnances</div>
          <div className="page-subtitle">{ordonnances.length} ordonnance{ordonnances.length > 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Nouvelle ordonnance</button>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : ordonnances.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucune ordonnance encore</div>
            <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>Créer la première ordonnance</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>Patient</th><th>Type</th><th>Date</th><th>Médicaments</th><th></th></tr></thead>
              <tbody>
                {ordonnances.map(o => (
                  <tr key={o.id}>
                    <td><span style={{ fontSize:12, fontWeight:600, color:'var(--purple)', fontFamily:'monospace' }}>{o.numero}</span></td>
                    <td style={{ fontWeight:500 }}>{o.patient?.first_name} {o.patient?.last_name}</td>
                    <td><span style={{ fontSize:11, background:'var(--purple-light)', color:'var(--purple)', padding:'2px 7px', borderRadius:99, fontWeight:600 }}>{o.type}</span></td>
                    <td style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDate(o.date_prescription)}</td>
                    <td style={{ fontSize:12, color:'var(--gray-600)' }}>{(o.lignes ?? []).length} ligne{(o.lignes ?? []).length > 1 ? 's' : ''}</td>
                    <td>
                      <button onClick={() => printOrdonnance(o)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-600)', display:'flex', gap:5, alignItems:'center' }}>
                        🖨️ Imprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nouvelle ordonnance */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:680 }}>
            <div className="modal-header">
              <div className="modal-title">📋 Nouvelle ordonnance</div>
              <button onClick={() => setShowNew(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Patient */}
                <div>
                  <label className="label">Patient *</label>
                  {selectedPat ? (
                    <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'var(--blue-light)', borderRadius:9, border:'1px solid var(--blue-mid)' }}>
                      <span style={{ fontWeight:600 }}>{selectedPat.first_name} {selectedPat.last_name}</span>
                      <button onClick={() => setPatientId('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', marginLeft:'auto', fontSize:16 }}>×</button>
                    </div>
                  ) : (
                    <>
                      <input className="input" value={searchPat} onChange={e => setSearchPat(e.target.value)} placeholder="Rechercher..." style={{ marginBottom:6 }} />
                      <div style={{ maxHeight:140, overflowY:'auto', border:'1px solid var(--gray-200)', borderRadius:8, overflow:'hidden' }}>
                        {filteredPats.slice(0,6).map(p => (
                          <div key={p.id} onClick={() => { setPatientId(p.id); setSearchPat('') }}
                            style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--gray-50)', fontSize:13 }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--gray-50)'}
                            onMouseLeave={e => e.currentTarget.style.background='white'}>
                            {p.first_name} {p.last_name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Type */}
                <div style={{ display:'flex', gap:8 }}>
                  {['medicaments','soins','bilan','arret_travail'].map(t => (
                    <button key={t} onClick={() => setType(t)}
                      style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', border:`1.5px solid ${type===t ? 'var(--purple)' : 'var(--gray-200)'}`, background: type===t ? 'var(--purple-light)' : 'white', color: type===t ? 'var(--purple)' : 'var(--gray-600)', fontWeight: type===t ? 600 : 400 }}>
                      {t === 'medicaments' ? '💊 Médicaments' : t === 'soins' ? '🩺 Soins' : t === 'bilan' ? '🔬 Bilan' : '📋 Arrêt'}
                    </button>
                  ))}
                </div>

                {/* Quick add */}
                <div>
                  <label className="label">Médicaments courants (cliquer pour ajouter)</label>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {MEDICAMENTS_COMMUNS.map(m => (
                      <button key={m.nom} onClick={() => {
                        const emptyIdx = lignes.findIndex(l => !l.medicament)
                        if (emptyIdx >= 0) {
                          selectMedicament(emptyIdx, m)
                        } else {
                          setLignes([...lignes, { medicament: m.nom, dosage: m.dosage, posologie: m.posologie, duree: m.duree, renouvellement: false }])
                        }
                      }}
                        style={{ fontSize:11, padding:'3px 9px', borderRadius:99, border:'1px solid var(--gray-200)', background:'var(--gray-50)', cursor:'pointer', color:'var(--gray-700)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--blue-light)'; e.currentTarget.style.borderColor='var(--blue-mid)' }}
                        onMouseLeave={e => { e.currentTarget.style.background='var(--gray-50)'; e.currentTarget.style.borderColor='var(--gray-200)' }}>
                        + {m.nom}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lignes */}
                {lignes.map((l, i) => (
                  <div key={i} style={{ padding:14, background:'var(--gray-50)', borderRadius:10, border:'1px solid var(--gray-200)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                      <div>
                        <label className="label">Médicament</label>
                        <input className="input" value={l.medicament} onChange={e => updateLigne(i, 'medicament', e.target.value)} placeholder="Nom du médicament" style={{ fontSize:13 }} />
                      </div>
                      <div>
                        <label className="label">Dosage / Forme</label>
                        <input className="input" value={l.dosage} onChange={e => updateLigne(i, 'dosage', e.target.value)} placeholder="ex: 1g, tube 30g..." style={{ fontSize:13 }} />
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div>
                        <label className="label">Posologie</label>
                        <input className="input" value={l.posologie} onChange={e => updateLigne(i, 'posologie', e.target.value)} placeholder="1 cp 3x/jour..." style={{ fontSize:13 }} />
                      </div>
                      <div>
                        <label className="label">Durée</label>
                        <div style={{ display:'flex', gap:6 }}>
                          <input className="input" value={l.duree} onChange={e => updateLigne(i, 'duree', e.target.value)} placeholder="7 jours..." style={{ fontSize:13 }} />
                          {lignes.length > 1 && (
                            <button onClick={() => setLignes(lignes.filter((_, idx) => idx !== i))}
                              style={{ width:34, height:34, borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)', fontSize:14, flexShrink:0 }}>×</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:7, marginTop:8, cursor:'pointer', fontSize:12, color:'var(--gray-600)' }}>
                      <input type="checkbox" checked={l.renouvellement} onChange={e => updateLigne(i, 'renouvellement', e.target.checked)} style={{ accentColor:'var(--purple)' }} />
                      Renouvelable
                    </label>
                  </div>
                ))}

                <button onClick={addLigne} style={{ fontSize:12, padding:'7px', borderRadius:8, border:'1px dashed var(--gray-300)', background:'var(--gray-50)', cursor:'pointer', color:'var(--gray-600)' }}>
                  + Ajouter un médicament
                </button>

                <div>
                  <label className="label">Instructions particulières</label>
                  <textarea className="input" value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} style={{ resize:'none' }} placeholder="Ex: Appliquer sur zone sèche, conserver au réfrigérateur..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleSave} disabled={saving || !patientId || lignes.every(l => !l.medicament)} className="btn-primary">
                {saving ? 'Création...' : '📋 Créer l\'ordonnance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
