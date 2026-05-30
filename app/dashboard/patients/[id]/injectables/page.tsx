'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const TYPES = {
  acide_hyaluronique:  { label: 'Acide Hyaluronique', icon: '💧', color: '#0891B2', bg: '#ECFEFF' },
  toxine_botulinique:  { label: 'Toxine Botulinique',  icon: '⚡', color: '#7C3AED', bg: '#F5F3FF' },
  prp:                 { label: 'PRP',                 icon: '🩸', color: '#DC2626', bg: '#FEF2F2' },
  mesoinjectable:      { label: 'Mésoinjectables',     icon: '✨', color: '#059669', bg: '#ECFDF5' },
  autre:               { label: 'Autre',               icon: '💉', color: '#6B7280', bg: '#F3F4F6' },
}

const MARQUES_HA = ['Allergan (AbbVie)', 'Galderma', 'Merz', 'Sinclair', 'Teoxane', 'Fillmed (Filorga)', 'Autre']
const MARQUES_BTX = ['Allergan (Botox)', 'Ipsen (Azzalure/Dysport)', 'Merz (Bocouture/Xeomin)', 'Hugel (Letybo)', 'Autre']

const PRODUITS_HA = [
  'Juvederm Ultra 2', 'Juvederm Ultra 3', 'Juvederm Ultra 4',
  'Juvederm Volbella', 'Juvederm Volift', 'Juvederm Voluma', 'Juvederm Volux',
  'Restylane', 'Restylane Kysse', 'Restylane Lyps', 'Restylane Defyne', 'Restylane Volyme',
  'Sculptra', 'Radiesse', 'Teosyal RHA', 'Belotero', 'Princess Rich',
]
const PRODUITS_BTX = [
  'Botox 50U', 'Botox 100U', 'Azzalure 125U', 'Azzalure 50U',
  'Dysport 300U', 'Bocouture 50U', 'Xeomin 50U', 'Xeomin 100U', 'Letybo 50U',
]

const ZONES_HA = [
  'Lèvres (volumisation)', 'Lèvres (contour)', 'Sillons naso-labiaux', 'Pommettes',
  'Cernes (vallée des larmes)', 'Tempes', 'Menton', 'Mâchoire (jawline)',
  'Nez (rhinomodulation)', 'Front', 'Sourcils (brow lift)', 'Mains',
]
const ZONES_BTX = [
  'Front (rides horizontales)', 'Lion (glabelle)', 'Pattes d\'oie',
  'Nez (bunny lines)', 'Lèvre (lip flip)', 'Menton (peau d\'orange)',
  'Cou (bandes platysma)', 'Décolleté', 'Transpiration (aisselles)', 'Bruxisme (masséters)',
]

type Zone = { zone: string; volume_ml?: number; unites?: number; technique?: string }
type FormData = {
  type_produit: string; marque: string; nom_produit: string;
  reference: string; numero_lot: string; date_expiration: string;
  concentration: string; volume_ml: string; nombre_unites: string;
  zones: Zone[]; notes: string; retouche_prevue: boolean; retouche_date: string;
}

const defaultForm: FormData = {
  type_produit: 'acide_hyaluronique', marque: '', nom_produit: '',
  reference: '', numero_lot: '', date_expiration: '',
  concentration: '', volume_ml: '', nombre_unites: '',
  zones: [], notes: '', retouche_prevue: false, retouche_date: '',
}

export default function InjectablesPage() {
  const params = useParams()
  const patientId = params.id as string
  const supabase = createClient()

  const [patient, setPatient]       = useState<any>(null)
  const [records, setRecords]       = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [clinicId, setClinicId]     = useState('')
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<any>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)

  // Form state
  const [form, setForm]             = useState<FormData>(defaultForm)
  const [selectedConsult, setSelectedConsult] = useState('')
  const [etiquetteFile, setEtiquetteFile] = useState<File | null>(null)
  const [etiquettePreview, setEtiquettePreview] = useState<string | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [zoneInput, setZoneInput]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)

    const [{ data: pat }, { data: recs }, { data: consults }] = await Promise.all([
      supabase.from('patients').select('first_name, last_name').eq('id', patientId).single(),
      supabase.from('injectable_records').select('*, consultation:consultations(created_at, acte_type)')
        .eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('consultations').select('id, created_at, acte_type, notes')
        .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
    ])
    setPatient(pat)
    setRecords(recs ?? [])
    setConsultations(consults ?? [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Photo étiquette → parsing IA
  async function scanEtiquette(file: File) {
    setScanning(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      try {
        const res = await fetch('/api/ai/scan-etiquette', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, type: form.type_produit }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.parsed) {
            setForm(prev => ({
              ...prev,
              marque: data.parsed.marque ?? prev.marque,
              nom_produit: data.parsed.nom_produit ?? prev.nom_produit,
              reference: data.parsed.reference ?? prev.reference,
              numero_lot: data.parsed.numero_lot ?? prev.numero_lot,
              date_expiration: data.parsed.date_expiration ?? prev.date_expiration,
              concentration: data.parsed.concentration ?? prev.concentration,
              volume_ml: data.parsed.volume_ml ?? prev.volume_ml,
            }))
            showToast('✓ Étiquette analysée par IA — champs pré-remplis')
          }
        }
      } catch {
        // IA non dispo — l'utilisateur remplit manuellement
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  function handleEtiquetteChange(file: File) {
    setEtiquetteFile(file)
    const url = URL.createObjectURL(file)
    setEtiquettePreview(url)
    scanEtiquette(file)
  }

  function addZone() {
    if (!zoneInput.trim()) return
    setForm(prev => ({ ...prev, zones: [...prev.zones, { zone: zoneInput, volume_ml: undefined, unites: undefined }] }))
    setZoneInput('')
  }

  function removeZone(idx: number) {
    setForm(prev => ({ ...prev, zones: prev.zones.filter((_, i) => i !== idx) }))
  }

  function updateZone(idx: number, field: keyof Zone, value: any) {
    setForm(prev => {
      const z = [...prev.zones]
      z[idx] = { ...z[idx], [field]: value }
      return { ...prev, zones: z }
    })
  }

  async function handleSave() {
    if (!form.type_produit || !form.nom_produit) return
    setSaving(true)

    let etiquetteUrl: string | null = null
    if (etiquetteFile) {
      const ext = etiquetteFile.name.split('.').pop()
      const path = `${clinicId}/${patientId}/etiquettes/${Date.now()}.${ext}`
      const { data: upload } = await supabase.storage.from('patient-photos').upload(path, etiquetteFile, { contentType: etiquetteFile.type })
      if (upload) {
        const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(path)
        etiquetteUrl = publicUrl
      }
    }

    const { error } = await supabase.from('injectable_records').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      consultation_id: selectedConsult || null,
      type_produit: form.type_produit,
      marque: form.marque || null,
      nom_produit: form.nom_produit,
      reference: form.reference || null,
      numero_lot: form.numero_lot || null,
      date_expiration: form.date_expiration || null,
      concentration: form.concentration || null,
      volume_ml: form.volume_ml ? +form.volume_ml : null,
      nombre_unites: form.nombre_unites ? +form.nombre_unites : null,
      zones: form.zones,
      notes: form.notes || null,
      retouche_prevue: form.retouche_prevue,
      retouche_date: form.retouche_date || null,
      etiquette_url: etiquetteUrl,
    })

    setSaving(false)
    if (!error) {
      showToast('✓ Injectable enregistré')
      setShowForm(false)
      setForm(defaultForm)
      setEtiquetteFile(null)
      setEtiquettePreview(null)
      setSelectedConsult('')
      load()
    } else {
      showToast(error.message, false)
    }
  }

  const isHA  = form.type_produit === 'acide_hyaluronique'
  const isBTX = form.type_produit === 'toxine_botulinique'
  const marques  = isHA ? MARQUES_HA : isBTX ? MARQUES_BTX : MARQUES_HA
  const produits = isHA ? PRODUITS_HA : isBTX ? PRODUITS_BTX : []
  const zonesDispos = isHA ? ZONES_HA : isBTX ? ZONES_BTX : []

  const totalHA  = records.filter(r => r.type_produit === 'acide_hyaluronique').reduce((s, r) => s + (r.volume_ml ?? 0), 0)
  const totalBTX = records.filter(r => r.type_produit === 'toxine_botulinique').reduce((s, r) => s + (r.nombre_unites ?? 0), 0)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500, boxShadow:'0 8px 24px rgba(0,0,0,.2)' }}>{toast.msg}</div>}

      <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
            <Link href={`/dashboard/patients/${patientId}`} style={{ color:'var(--gray-400)', textDecoration:'none' }}>
              {patient?.first_name} {patient?.last_name}
            </Link> › Injectables
          </div>
          <div className="page-title">Traçabilité des injectables</div>
          <div className="page-subtitle">
            {records.length} injection{records.length > 1 ? 's' : ''} enregistrée{records.length > 1 ? 's' : ''}
            {totalHA > 0 && ` · ${totalHA.toFixed(1)} mL HA`}
            {totalBTX > 0 && ` · ${totalBTX} U Botox`}
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ fontSize:13, display:'flex', gap:6, alignItems:'center' }}>
          💉 Enregistrer un injectable
        </button>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:24 }}>
        {records.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:80, textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>💉</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucun injectable enregistré</div>
            <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:24, maxWidth:380 }}>
              Photographiez l'étiquette ou saisissez les informations du produit. L'IA pré-remplit automatiquement les champs depuis la photo.
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ fontSize:13 }}>
              Enregistrer le premier injectable
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:900 }}>
            {records.map(rec => {
              const tc = TYPES[rec.type_produit as keyof typeof TYPES] ?? TYPES.autre
              const isOpen = expanded === rec.id
              return (
                <div key={rec.id} className="card" style={{ overflow:'hidden' }}>
                  {/* Header cliquable */}
                  <div style={{ padding:'14px 18px', display:'flex', gap:14, alignItems:'center', cursor:'pointer' }}
                    onClick={() => setExpanded(isOpen ? null : rec.id)}>
                    {/* Photo étiquette miniature */}
                    {rec.etiquette_url ? (
                      <img src={rec.etiquette_url} alt="étiquette" style={{ width:52, height:52, objectFit:'cover', borderRadius:8, flexShrink:0, border:'1px solid var(--gray-200)' }} />
                    ) : (
                      <div style={{ width:52, height:52, borderRadius:8, background: tc.bg, border:`1px solid ${tc.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                        {tc.icon}
                      </div>
                    )}

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)' }}>{rec.nom_produit}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:tc.color, background:tc.bg, padding:'2px 8px', borderRadius:99 }}>{tc.icon} {tc.label}</span>
                        {rec.retouche_prevue && (
                          <span style={{ fontSize:10, background:'#FFFBEB', color:'#D97706', padding:'2px 6px', borderRadius:99, fontWeight:600 }}>Retouche prévue</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--gray-500)', flexWrap:'wrap' }}>
                        {rec.marque && <span>🏭 {rec.marque}</span>}
                        {rec.volume_ml && <span>💧 {rec.volume_ml} mL</span>}
                        {rec.nombre_unites && <span>⚡ {rec.nombre_unites} U</span>}
                        {rec.numero_lot && <span style={{ fontFamily:'monospace', fontSize:11 }}>LOT: {rec.numero_lot}</span>}
                        {rec.date_expiration && <span>Exp: {formatDate(rec.date_expiration)}</span>}
                        <span>📅 {formatDate(rec.created_at)}</span>
                      </div>
                      {rec.zones?.length > 0 && (
                        <div style={{ display:'flex', gap:4, marginTop:5, flexWrap:'wrap' }}>
                          {(rec.zones as Zone[]).slice(0, 4).map((z, i) => (
                            <span key={i} style={{ fontSize:10, background:'var(--gray-100)', color:'var(--gray-600)', padding:'1px 6px', borderRadius:99 }}>
                              {z.zone}{z.volume_ml ? ` (${z.volume_ml}mL)` : ''}{z.unites ? ` (${z.unites}U)` : ''}
                            </span>
                          ))}
                          {rec.zones.length > 4 && <span style={{ fontSize:10, color:'var(--gray-400)' }}>+{rec.zones.length - 4}</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ flexShrink:0, color:'var(--gray-400)', fontSize:14 }}>{isOpen ? '▲' : '▼'}</div>
                  </div>

                  {/* Détail déplié */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid var(--gray-100)', padding:'16px 18px', background:'var(--gray-50)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Identification produit</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                            {[
                              ['Produit', rec.nom_produit],
                              ['Marque', rec.marque],
                              ['Référence', rec.reference],
                              ['N° de lot', rec.numero_lot],
                              ['Date d\'expiration', rec.date_expiration ? formatDate(rec.date_expiration) : null],
                              ['Concentration', rec.concentration],
                              ['Volume injecté', rec.volume_ml ? `${rec.volume_ml} mL` : null],
                              ['Unités', rec.nombre_unites ? `${rec.nombre_unites} U` : null],
                            ].filter(([,v]) => v).map(([k, v]) => (
                              <div key={k as string} style={{ display:'flex', gap:8 }}>
                                <span style={{ fontSize:12, color:'var(--gray-500)', minWidth:130 }}>{k as string}</span>
                                <span style={{ fontSize:12, fontWeight:500, color:'var(--gray-900)', fontFamily: k === 'N° de lot' || k === 'Référence' ? 'monospace' : 'inherit' }}>{v as string}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Zones injectées</div>
                          {rec.zones?.length > 0 ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {(rec.zones as Zone[]).map((z, i) => (
                                <div key={i} style={{ display:'flex', gap:8, padding:'5px 8px', background:'white', borderRadius:6, border:'1px solid var(--gray-200)' }}>
                                  <span style={{ flex:1, fontSize:12, fontWeight:500 }}>{z.zone}</span>
                                  {z.volume_ml && <span style={{ fontSize:11, color:'var(--blue)' }}>{z.volume_ml} mL</span>}
                                  {z.unites && <span style={{ fontSize:11, color:'var(--purple)' }}>{z.unites} U</span>}
                                  {z.technique && <span style={{ fontSize:10, color:'var(--gray-400)' }}>{z.technique}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize:12, color:'var(--gray-400)' }}>Non renseigné</span>
                          )}
                          {rec.notes && (
                            <div style={{ marginTop:10 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Notes</div>
                              <div style={{ fontSize:12, color:'var(--gray-700)', fontStyle:'italic' }}>{rec.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Photo étiquette agrandie */}
                      {rec.etiquette_url && (
                        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--gray-200)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Photo de l'étiquette</div>
                          <img src={rec.etiquette_url} alt="étiquette" style={{ maxHeight:200, borderRadius:8, border:'1px solid var(--gray-200)', cursor:'pointer' }}
                            onClick={() => window.open(rec.etiquette_url, '_blank')} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal saisie injectable */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:660, maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ flexShrink:0 }}>
              <div className="modal-title">💉 Enregistrer un injectable</div>
              <button onClick={() => { setShowForm(false); setForm(defaultForm); setEtiquettePreview(null); setEtiquetteFile(null) }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 }}>

              {/* Type produit */}
              <div>
                <label className="label">Type de produit *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
                  {Object.entries(TYPES).map(([key, tc]) => (
                    <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type_produit: key, marque:'', nom_produit:'', zones:[] }))}
                      style={{ padding:'8px 4px', borderRadius:9, cursor:'pointer', border:`1.5px solid ${form.type_produit===key ? tc.color : 'var(--gray-200)'}`, background: form.type_produit===key ? tc.bg : 'white', textAlign:'center', transition:'all .1s' }}>
                      <div style={{ fontSize:18 }}>{tc.icon}</div>
                      <div style={{ fontSize:9.5, fontWeight:600, color: form.type_produit===key ? tc.color : 'var(--gray-500)', marginTop:3, lineHeight:1.2 }}>{tc.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo étiquette */}
              <div>
                <label className="label">📸 Photo de l'étiquette (optionnel — l'IA extrait les infos)</label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
                  onChange={e => e.target.files?.[0] && handleEtiquetteChange(e.target.files[0])} />

                {etiquettePreview ? (
                  <div style={{ display:'flex', gap:12, alignItems:'center', padding:12, background:'var(--gray-50)', borderRadius:10, border:'1px solid var(--gray-200)' }}>
                    <img src={etiquettePreview} alt="preview" style={{ height:80, borderRadius:7, border:'1px solid var(--gray-200)', objectFit:'cover' }} />
                    <div style={{ flex:1 }}>
                      {scanning ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--blue)', fontWeight:500 }}>
                          <div style={{ width:16, height:16, border:'2px solid var(--blue-mid)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
                          Analyse IA en cours...
                          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        </div>
                      ) : (
                        <div style={{ fontSize:12, color:'var(--gray-600)' }}>✓ Étiquette ajoutée — champs pré-remplis ci-dessous</div>
                      )}
                    </div>
                    <button type="button" onClick={() => { setEtiquettePreview(null); setEtiquetteFile(null) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:16 }}>×</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      style={{ flex:1, padding:'11px', borderRadius:9, border:'2px dashed var(--gray-300)', background:'var(--gray-50)', cursor:'pointer', fontSize:13, color:'var(--gray-600)', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                      📸 Photographier l'étiquette
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      style={{ flex:1, padding:'11px', borderRadius:9, border:'2px dashed var(--gray-300)', background:'var(--gray-50)', cursor:'pointer', fontSize:13, color:'var(--gray-600)', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                      🖼️ Charger une image
                    </button>
                  </div>
                )}
              </div>

              {/* Saisie manuelle */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Produit *</label>
                  {produits.length > 0 ? (
                    <select className="input" value={form.nom_produit} onChange={e => setForm(f => ({ ...f, nom_produit: e.target.value }))} style={{ fontSize:13 }}>
                      <option value="">Sélectionner ou saisir...</option>
                      {produits.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : null}
                  <input className="input" value={form.nom_produit} onChange={e => setForm(f => ({ ...f, nom_produit: e.target.value }))}
                    placeholder={isHA ? 'ex: Juvederm Ultra 3' : isBTX ? 'ex: Botox 100U' : 'Nom du produit'} style={{ fontSize:13, marginTop: produits.length > 0 ? 5 : 0 }} />
                </div>

                <div>
                  <label className="label">Marque / Laboratoire</label>
                  <select className="input" value={form.marque} onChange={e => setForm(f => ({ ...f, marque: e.target.value }))} style={{ fontSize:13 }}>
                    <option value="">Sélectionner...</option>
                    {marques.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">N° de lot (LOT/BATCH)</label>
                  <input className="input" value={form.numero_lot} onChange={e => setForm(f => ({ ...f, numero_lot: e.target.value }))}
                    placeholder="ex: LOT A12345B" style={{ fontSize:13, fontFamily:'monospace' }} />
                </div>

                <div>
                  <label className="label">Date d'expiration</label>
                  <input className="input" type="date" value={form.date_expiration} onChange={e => setForm(f => ({ ...f, date_expiration: e.target.value }))} style={{ fontSize:13 }} />
                </div>

                <div>
                  <label className="label">Référence produit</label>
                  <input className="input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="ex: REF-1234" style={{ fontSize:13 }} />
                </div>

                <div>
                  <label className="label">Concentration</label>
                  <input className="input" value={form.concentration} onChange={e => setForm(f => ({ ...f, concentration: e.target.value }))}
                    placeholder={isHA ? 'ex: 24 mg/mL' : '125U/0.5mL'} style={{ fontSize:13 }} />
                </div>

                {!isBTX && (
                  <div>
                    <label className="label">Volume total injecté (mL)</label>
                    <input className="input" type="number" step="0.1" min="0" value={form.volume_ml}
                      onChange={e => setForm(f => ({ ...f, volume_ml: e.target.value }))} placeholder="ex: 1.5" style={{ fontSize:13 }} />
                  </div>
                )}

                {isBTX && (
                  <div>
                    <label className="label">Nombre d'unités injectées</label>
                    <input className="input" type="number" step="1" min="0" value={form.nombre_unites}
                      onChange={e => setForm(f => ({ ...f, nombre_unites: e.target.value }))} placeholder="ex: 50" style={{ fontSize:13 }} />
                  </div>
                )}
              </div>

              {/* Zones injectées */}
              <div>
                <label className="label">Zones injectées</label>
                {zonesDispos.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                    {zonesDispos.map(z => {
                      const active = form.zones.some(fz => fz.zone === z)
                      return (
                        <button key={z} type="button"
                          onClick={() => active ? removeZone(form.zones.findIndex(fz => fz.zone === z)) : setForm(f => ({ ...f, zones: [...f.zones, { zone: z }] }))}
                          style={{ fontSize:11, padding:'3px 9px', borderRadius:99, cursor:'pointer', border:`1.5px solid ${active ? 'var(--blue)' : 'var(--gray-200)'}`, background: active ? 'var(--blue-light)' : 'white', color: active ? 'var(--blue-dark)' : 'var(--gray-600)', fontWeight: active ? 600 : 400 }}>
                          {active ? '✓ ' : '+ '}{z}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Zones sélectionnées avec volume/unités */}
                {form.zones.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
                    {form.zones.map((z, i) => (
                      <div key={i} style={{ display:'flex', gap:6, alignItems:'center', padding:'6px 10px', background:'var(--gray-50)', borderRadius:7 }}>
                        <span style={{ flex:1, fontSize:12, fontWeight:500 }}>{z.zone}</span>
                        {!isBTX && (
                          <input type="number" step="0.1" min="0" value={z.volume_ml ?? ''} onChange={e => updateZone(i, 'volume_ml', +e.target.value || undefined)}
                            placeholder="mL" style={{ width:55, fontSize:11, padding:'2px 6px', borderRadius:5, border:'1px solid var(--gray-200)', textAlign:'center' }} />
                        )}
                        {isBTX && (
                          <input type="number" step="1" min="0" value={z.unites ?? ''} onChange={e => updateZone(i, 'unites', +e.target.value || undefined)}
                            placeholder="U" style={{ width:50, fontSize:11, padding:'2px 6px', borderRadius:5, border:'1px solid var(--gray-200)', textAlign:'center' }} />
                        )}
                        <input value={z.technique ?? ''} onChange={e => updateZone(i, 'technique', e.target.value)}
                          placeholder="technique..." style={{ width:90, fontSize:10, padding:'2px 6px', borderRadius:5, border:'1px solid var(--gray-200)' }} />
                        <button type="button" onClick={() => removeZone(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Saisie libre */}
                <div style={{ display:'flex', gap:6 }}>
                  <input className="input" value={zoneInput} onChange={e => setZoneInput(e.target.value)}
                    placeholder="Ajouter une zone personnalisée..." style={{ fontSize:12, flex:1 }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addZone())} />
                  <button type="button" onClick={addZone} className="btn-secondary" style={{ fontSize:12, flexShrink:0 }}>+ Ajouter</button>
                </div>
              </div>

              {/* Consultation liée */}
              {consultations.length > 0 && (
                <div>
                  <label className="label">Consultation associée (optionnel)</label>
                  <select className="input" value={selectedConsult} onChange={e => setSelectedConsult(e.target.value)} style={{ fontSize:13 }}>
                    <option value="">Non liée à une consultation</option>
                    {consultations.map(c => (
                      <option key={c.id} value={c.id}>{formatDate(c.created_at)} — {c.acte_type ?? 'Consultation'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes + retouche */}
              <div>
                <label className="label">Notes / Observations</label>
                <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} style={{ resize:'none', fontSize:13 }} placeholder="Résultat immédiat, remarques techniques..." />
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', borderRadius:9, border:'1px solid var(--gray-200)', background:'var(--gray-50)' }}>
                <input type="checkbox" checked={form.retouche_prevue} onChange={e => setForm(f => ({ ...f, retouche_prevue: e.target.checked }))} style={{ accentColor:'var(--orange)' }} />
                <span style={{ fontSize:13, fontWeight:500, color:'var(--gray-700)' }}>Retouche prévue</span>
                {form.retouche_prevue && (
                  <input type="date" value={form.retouche_date} onChange={e => setForm(f => ({ ...f, retouche_date: e.target.value }))}
                    style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid var(--gray-200)', fontSize:12 }} />
                )}
              </label>
            </div>

            <div className="modal-footer" style={{ flexShrink:0 }}>
              <button type="button" onClick={() => { setShowForm(false); setForm(defaultForm); setEtiquettePreview(null); setEtiquetteFile(null) }} className="btn-secondary">Annuler</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.nom_produit} className="btn-primary">
                {saving ? 'Enregistrement...' : '💉 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
