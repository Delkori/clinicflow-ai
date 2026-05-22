'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const TYPES = [
  { value: 'before',   label: 'Avant',      color: '#2563EB', bg: '#EFF6FF' },
  { value: 'after',    label: 'Après',      color: '#059669', bg: '#F0FDF4' },
  { value: 'progress', label: 'Évolution',  color: '#D97706', bg: '#FFFBEB' },
  { value: 'other',    label: 'Autre',      color: '#475569', bg: '#F8FAFC' },
]

const ANGLES = [
  { value: 'face',          label: 'Face' },
  { value: 'profile_left',  label: 'Profil G' },
  { value: 'profile_right', label: 'Profil D' },
  { value: 'top',           label: 'Dessus' },
  { value: 'other',         label: 'Autre' },
]

export default function PatientPhotosPage() {
  const { id } = useParams()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [patient, setPatient] = useState<any>(null)
  const [treatments, setTreatments] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [comparisons, setComparisons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [clinicId, setClinicId] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterTreatment, setFilterTreatment] = useState<string>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [lightbox, setLightbox] = useState<any>(null)
  const [compareView, setCompareView] = useState<any>(null)
  const [uploadForm, setUploadForm] = useState({ type: 'before', angle: 'face', treatment_id: '', notes: '', taken_at: new Date().toISOString().split('T')[0] })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user!.id).single()
    if (profile) setClinicId(profile.clinic_id)

    const [{ data: p }, { data: ph }, { data: c }, { data: t }] = await Promise.all([
      supabase.from('patients').select('first_name, last_name').eq('id', id).single(),
      supabase.from('patient_photos').select('*, treatment:treatments(name,color)').eq('patient_id', id).order('taken_at', { ascending: false }),
      supabase.from('photo_comparisons').select('*, before_photo:patient_photos!before_photo_id(*), after_photo:patient_photos!after_photo_id(*), treatment:treatments(name,color)').eq('patient_id', id),
      supabase.from('treatments').select('id,name,color'),
    ])
    setPatient(p)
    setPhotos(ph ?? [])
    setComparisons(c ?? [])
    setTreatments(t ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    setSelectedFiles(Array.from(files).filter(f => f.type.startsWith('image/')))
    setShowUpload(true)
  }

  async function uploadPhotos() {
    if (!selectedFiles.length) return
    setUploading(true)
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop()
      const path = `${clinicId}/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploaded } = await supabase.storage.from('patient-photos').upload(path, file, { upsert: false })
      if (!uploaded) continue
      const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(uploaded.path)
      await supabase.from('patient_photos').insert({
        patient_id: id, clinic_id: clinicId,
        type: uploadForm.type, angle: uploadForm.angle,
        treatment_id: uploadForm.treatment_id || null,
        notes: uploadForm.notes || null,
        taken_at: uploadForm.taken_at,
        url: publicUrl,
      })
    }
    setSelectedFiles([])
    setShowUpload(false)
    setUploading(false)
    await load()
  }

  async function deletePhoto(photoId: string, url: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await supabase.from('patient_photos').delete().eq('id', photoId)
    const path = url.split('/patient-photos/')[1]
    if (path) await supabase.storage.from('patient-photos').remove([path])
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  async function createComparison(beforeId: string, afterId: string, treatmentId?: string) {
    const title = `Avant/Après — ${treatments.find(t => t.id === treatmentId)?.name ?? ''} — ${formatDate(new Date().toISOString())}`
    const { data } = await supabase.from('photo_comparisons').insert({
      patient_id: id, clinic_id: clinicId, before_photo_id: beforeId, after_photo_id: afterId,
      treatment_id: treatmentId || null, title, is_shareable: false,
    }).select('*, before_photo:patient_photos!before_photo_id(*), after_photo:patient_photos!after_photo_id(*), treatment:treatments(name,color)').single()
    if (data) { setComparisons(prev => [...prev, data]); setShowCompare(false) }
  }

  async function toggleShare(compId: string, current: boolean) {
    await supabase.from('photo_comparisons').update({ is_shareable: !current, shared_at: !current ? new Date().toISOString() : null }).eq('id', compId)
    setComparisons(prev => prev.map(c => c.id === compId ? { ...c, is_shareable: !current } : c))
  }

  const filtered = photos.filter(p =>
    (filterType === 'all' || p.type === filterType) &&
    (filterTreatment === 'all' || p.treatment_id === filterTreatment)
  )

  const beforePhotos = photos.filter(p => p.type === 'before')
  const afterPhotos  = photos.filter(p => p.type === 'after')

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:'28px', height:'28px', border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ fontSize:'12px', color:'var(--gray-400)', marginBottom:'10px', display:'flex', gap:'6px', alignItems:'center' }}>
          <Link href="/dashboard/patients" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Patients</Link>
          <span>›</span>
          <Link href={`/dashboard/patients/${id}`} style={{ color:'var(--gray-400)', textDecoration:'none' }}>{patient?.first_name} {patient?.last_name}</Link>
          <span>›</span>
          <span>Photos</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div className="page-title">📸 Photos — {patient?.first_name} {patient?.last_name}</div>
            <div className="page-subtitle">{photos.length} photo{photos.length > 1 ? 's' : ''} · {comparisons.length} comparaison{comparisons.length > 1 ? 's' : ''}</div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {beforePhotos.length > 0 && afterPhotos.length > 0 && (
              <button onClick={() => setShowCompare(true)} className="btn-secondary" style={{ fontSize:'13px' }}>
                ⚖️ Créer avant/après
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              + Ajouter des photos
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* Comparisons section */}
        {comparisons.length > 0 && (
          <div style={{ marginBottom:'24px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--gray-900)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
              ⚖️ Comparaisons avant/après
              <span style={{ fontSize:'12px', fontWeight:'400', color:'var(--gray-500)' }}>{comparisons.length} comparaison{comparisons.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:'14px' }}>
              {comparisons.map(comp => (
                <div key={comp.id} className="card" style={{ overflow:'hidden' }}>
                  {/* Before/After split view */}
                  <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setCompareView(comp)}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px', background:'var(--gray-900)' }}>
                      <div style={{ position:'relative' }}>
                        <img src={comp.before_photo?.url} alt="Avant" style={{ width:'100%', height:'180px', objectFit:'cover', display:'block' }} />
                        <div style={{ position:'absolute', bottom:'6px', left:'6px', background:'rgba(0,0,0,0.7)', color:'white', fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px', letterSpacing:'0.05em' }}>AVANT</div>
                      </div>
                      <div style={{ position:'relative' }}>
                        <img src={comp.after_photo?.url} alt="Après" style={{ width:'100%', height:'180px', objectFit:'cover', display:'block' }} />
                        <div style={{ position:'absolute', bottom:'6px', right:'6px', background:'rgba(5,150,222,0.85)', color:'white', fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px', letterSpacing:'0.05em' }}>APRÈS</div>
                      </div>
                    </div>
                    <div style={{ position:'absolute', inset:0, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                      <div style={{ background:'rgba(0,0,0,0.6)', color:'white', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'600' }}>🔍 Voir en plein écran</div>
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
                    {comp.treatment && <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:comp.treatment.color, flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12.5px', fontWeight:'500', color:'var(--gray-800)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{comp.title}</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      <button onClick={() => toggleShare(comp.id, comp.is_shareable)}
                        style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'6px', border:'1px solid', borderColor: comp.is_shareable ? '#BBF7D0' : 'var(--gray-200)', background: comp.is_shareable ? '#F0FDF4' : 'white', color: comp.is_shareable ? '#059669' : 'var(--gray-500)', cursor:'pointer', fontWeight:'500' }}>
                        {comp.is_shareable ? '🔗 Partagé' : '🔗 Partager'}
                      </button>
                      {comp.is_shareable && (
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${comp.share_token}`); alert('Lien copié !') }}
                          style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'6px', border:'1px solid var(--blue-mid)', background:'var(--blue-light)', color:'var(--blue)', cursor:'pointer' }}>
                          📋 Copier lien
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone if no photos */}
        {photos.length === 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver ? 'var(--blue)' : 'var(--gray-200)'}`, borderRadius:'16px', padding:'64px 40px', textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--blue-light)' : 'white', transition:'all 0.15s' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📸</div>
            <div style={{ fontSize:'16px', fontWeight:'600', color:'var(--gray-800)', marginBottom:'6px' }}>Glissez vos photos ici</div>
            <div style={{ fontSize:'13px', color:'var(--gray-500)', marginBottom:'16px' }}>Ou cliquez pour sélectionner · JPG, PNG, WebP</div>
            <div className="btn-primary" style={{ display:'inline-flex' }}>Choisir des photos</div>
          </div>
        )}

        {/* Filters + Grid */}
        {photos.length > 0 && (
          <div>
            {/* Filters */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={() => setFilterType('all')} style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', background: filterType === 'all' ? 'var(--blue)' : 'white', color: filterType === 'all' ? 'white' : 'var(--gray-600)', outline: filterType === 'all' ? 'none' : '1px solid var(--gray-200)' }}>Toutes ({photos.length})</button>
                {TYPES.map(t => {
                  const cnt = photos.filter(p => p.type === t.value).length
                  if (cnt === 0) return null
                  return (
                    <button key={t.value} onClick={() => setFilterType(t.value)} style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', background: filterType === t.value ? t.color : 'white', color: filterType === t.value ? 'white' : t.color, outline: filterType === t.value ? 'none' : `1px solid ${t.bg}` }}>
                      {t.label} ({cnt})
                    </button>
                  )
                })}
              </div>
              {treatments.length > 0 && (
                <select value={filterTreatment} onChange={e => setFilterTreatment(e.target.value)}
                  className="input" style={{ width:'auto', fontSize:'12px', padding:'5px 10px' }}>
                  <option value="all">Tous les traitements</option>
                  {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>

            {/* Photo grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px' }}>
              {filtered.map(photo => {
                const typeInfo = TYPES.find(t => t.value === photo.type)
                return (
                  <div key={photo.id} className="card" style={{ overflow:'hidden', cursor:'pointer' }}
                    onClick={() => setLightbox(photo)}>
                    <div style={{ position:'relative', paddingTop:'75%', background:'var(--gray-100)' }}>
                      <img src={photo.url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                      <div style={{ position:'absolute', top:'6px', left:'6px' }}>
                        <span style={{ background:typeInfo?.color, color:'white', fontSize:'9px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px', letterSpacing:'0.04em' }}>
                          {typeInfo?.label.toUpperCase()}
                        </span>
                      </div>
                      {photo.treatment && (
                        <div style={{ position:'absolute', top:'6px', right:'6px', width:'8px', height:'8px', borderRadius:'50%', background:photo.treatment.color, border:'1.5px solid white' }} />
                      )}
                    </div>
                    <div style={{ padding:'8px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:'11px', fontWeight:'500', color:'var(--gray-700)' }}>{ANGLES.find(a => a.value === photo.angle)?.label}</div>
                        <div style={{ fontSize:'10px', color:'var(--gray-400)' }}>{formatDate(photo.taken_at)}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deletePhoto(photo.id, photo.url) }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-300)', fontSize:'13px', padding:'2px' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-300)'}>
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
              {/* Add more */}
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'2px dashed var(--gray-200)', borderRadius:'12px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', cursor:'pointer', minHeight:'160px', background:'var(--gray-50)', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.background = 'var(--blue-light)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.background = 'var(--gray-50)' }}>
                <span style={{ fontSize:'24px' }}>+</span>
                <span style={{ fontSize:'11px', color:'var(--gray-500)', fontWeight:'500' }}>Ajouter</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && selectedFiles.length > 0 && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:'520px' }}>
            <div className="modal-header">
              <div className="modal-title">Configurer les photos ({selectedFiles.length})</div>
              <button onClick={() => { setShowUpload(false); setSelectedFiles([]) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body">
              {/* Preview */}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
                {selectedFiles.map((f,i) => (
                  <div key={i} style={{ width:'64px', height:'64px', borderRadius:'8px', overflow:'hidden', background:'var(--gray-100)' }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="label">Type *</label>
                  <select className="input" value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Angle</label>
                  <select className="input" value={uploadForm.angle} onChange={e => setUploadForm(f => ({ ...f, angle: e.target.value }))}>
                    {ANGLES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="label">Traitement associé</label>
                  <select className="input" value={uploadForm.treatment_id} onChange={e => setUploadForm(f => ({ ...f, treatment_id: e.target.value }))}>
                    <option value="">—</option>
                    {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date prise</label>
                  <input className="input" type="date" value={uploadForm.taken_at} onChange={e => setUploadForm(f => ({ ...f, taken_at: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} placeholder="Zone traitée, session n°..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowUpload(false); setSelectedFiles([]) }} className="btn-secondary">Annuler</button>
              <button onClick={uploadPhotos} disabled={uploading} className="btn-primary">
                {uploading ? 'Upload en cours...' : `Uploader ${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create comparison modal */}
      {showCompare && (
        <CompareModal
          beforePhotos={beforePhotos} afterPhotos={afterPhotos} treatments={treatments}
          onClose={() => setShowCompare(false)}
          onCreate={createComparison}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setLightbox(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
            <img src={lightbox.url} alt="" style={{ maxWidth:'90vw', maxHeight:'80vh', objectFit:'contain', borderRadius:'8px' }} />
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent, rgba(0,0,0,0.8))', padding:'16px', borderRadius:'0 0 8px 8px', display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ color:'white', fontSize:'12px' }}>{TYPES.find(t => t.value === lightbox.type)?.label} · {ANGLES.find(a => a.value === lightbox.angle)?.label} · {formatDate(lightbox.taken_at)}</span>
              {lightbox.notes && <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'12px' }}>— {lightbox.notes}</span>}
            </div>
            <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:-12, right:-12, width:'32px', height:'32px', borderRadius:'50%', background:'white', border:'none', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
        </div>
      )}

      {/* Compare lightbox */}
      {compareView && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}
          onClick={() => setCompareView(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'90vw', maxWidth:'900px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', borderRadius:'12px', overflow:'hidden' }}>
              <div style={{ position:'relative' }}>
                <img src={compareView.before_photo?.url} alt="Avant" style={{ width:'100%', height:'70vh', objectFit:'cover', display:'block' }} />
                <div style={{ position:'absolute', bottom:'12px', left:'12px', background:'rgba(0,0,0,0.75)', color:'white', fontSize:'14px', fontWeight:'700', padding:'6px 14px', borderRadius:'8px', letterSpacing:'0.05em' }}>AVANT</div>
              </div>
              <div style={{ position:'relative' }}>
                <img src={compareView.after_photo?.url} alt="Après" style={{ width:'100%', height:'70vh', objectFit:'cover', display:'block' }} />
                <div style={{ position:'absolute', bottom:'12px', right:'12px', background:'rgba(5,150,222,0.85)', color:'white', fontSize:'14px', fontWeight:'700', padding:'6px 14px', borderRadius:'8px', letterSpacing:'0.05em' }}>APRÈS</div>
              </div>
            </div>
            <div style={{ textAlign:'center', marginTop:'12px', color:'rgba(255,255,255,0.6)', fontSize:'13px' }}>{compareView.title}</div>
          </div>
          <button onClick={() => setCompareView(null)} style={{ position:'fixed', top:'16px', right:'16px', width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', color:'white', fontSize:'18px' }}>×</button>
        </div>
      )}
    </div>
  )
}

function CompareModal({ beforePhotos, afterPhotos, treatments, onClose, onCreate }: any) {
  const [selectedBefore, setSelectedBefore] = useState<string>('')
  const [selectedAfter, setSelectedAfter]   = useState<string>('')
  const [treatmentId, setTreatmentId]       = useState<string>('')

  const before = beforePhotos.find((p: any) => p.id === selectedBefore)
  const after  = afterPhotos.find((p: any) => p.id === selectedAfter)

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:'600px' }}>
        <div className="modal-header">
          <div className="modal-title">Créer une comparaison avant/après</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:'var(--gray-400)' }}>×</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {/* Preview */}
          {(before || after) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', borderRadius:'10px', overflow:'hidden', border:'1px solid var(--gray-200)' }}>
              <div style={{ position:'relative', background:'var(--gray-100)', height:'160px' }}>
                {before ? <img src={before.url} alt="Avant" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--gray-400)', fontSize:'13px' }}>Sélectionner AVANT</div>}
                <div style={{ position:'absolute', bottom:'6px', left:'6px', background:'rgba(0,0,0,0.65)', color:'white', fontSize:'10px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px' }}>AVANT</div>
              </div>
              <div style={{ position:'relative', background:'var(--gray-100)', height:'160px' }}>
                {after ? <img src={after.url} alt="Après" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--gray-400)', fontSize:'13px' }}>Sélectionner APRÈS</div>}
                <div style={{ position:'absolute', bottom:'6px', right:'6px', background:'rgba(5,150,222,0.85)', color:'white', fontSize:'10px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px' }}>APRÈS</div>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label className="label">Photo AVANT *</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'160px', overflowY:'auto' }}>
                {beforePhotos.map((p: any) => (
                  <div key={p.id} onClick={() => setSelectedBefore(p.id)}
                    style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'7px', cursor:'pointer', border:`1.5px solid ${selectedBefore === p.id ? 'var(--blue)' : 'var(--gray-200)'}`, background: selectedBefore === p.id ? 'var(--blue-light)' : 'white', transition:'all 0.1s' }}>
                    <img src={p.url} alt="" style={{ width:'32px', height:'32px', borderRadius:'5px', objectFit:'cover', flexShrink:0 }} />
                    <div style={{ fontSize:'11px', color:'var(--gray-700)' }}>{formatDate(p.taken_at)} — {ANGLES.find(a => a.value === p.angle)?.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Photo APRÈS *</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'160px', overflowY:'auto' }}>
                {afterPhotos.map((p: any) => (
                  <div key={p.id} onClick={() => setSelectedAfter(p.id)}
                    style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'7px', cursor:'pointer', border:`1.5px solid ${selectedAfter === p.id ? 'var(--blue)' : 'var(--gray-200)'}`, background: selectedAfter === p.id ? 'var(--blue-light)' : 'white', transition:'all 0.1s' }}>
                    <img src={p.url} alt="" style={{ width:'32px', height:'32px', borderRadius:'5px', objectFit:'cover', flexShrink:0 }} />
                    <div style={{ fontSize:'11px', color:'var(--gray-700)' }}>{formatDate(p.taken_at)} — {ANGLES.find(a => a.value === p.angle)?.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Traitement associé</label>
            <select className="input" value={treatmentId} onChange={e => setTreatmentId(e.target.value)}>
              <option value="">—</option>
              {treatments.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={() => onCreate(selectedBefore, selectedAfter, treatmentId || undefined)} disabled={!selectedBefore || !selectedAfter} className="btn-primary">
            Créer la comparaison →
          </button>
        </div>
      </div>
    </div>
  )
}
