'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const ANGLES = ['Face', 'Profil droit', 'Profil gauche', '¾ droit', '¾ gauche', 'Dessus', 'Arrière', 'Détail']
const TYPES  = [
  { value: 'before',   label: 'Avant',         color: '#DC2626', bg: '#FEF2F2'  },
  { value: 'after',    label: 'Après',          color: '#059669', bg: '#ECFDF5'  },
  { value: 'progress', label: 'En cours',       color: '#0891B2', bg: '#ECFEFF'  },
  { value: 'consult',  label: 'Consultation',   color: '#7C3AED', bg: '#F5F3FF'  },
]
const SESSION_LABELS = [
  'Avant intervention', 'Jour J', 'J+7', 'J+15', 'J+30',
  '3 mois', '6 mois', '1 an', 'Résultat final',
]

export default function PatientPhotosPage() {
  const params = useParams()
  const patientId = params.id as string
  const supabase  = createClient()

  const [patient,   setPatient]   = useState<any>(null)
  const [photos,    setPhotos]    = useState<any[]>([])
  const [sessions,  setSessions]  = useState<any[]>([])
  const [treatments,setTreatments]= useState<any[]>([])
  const [comparisons,setComparisons] = useState<any[]>([])
  const [clinicId,  setClinicId]  = useState('')
  const [loading,   setLoading]   = useState(true)

  // UI state
  const [view,      setView]      = useState<'gallery'|'timeline'|'compare'>('gallery')
  const [filterType,setFilterType]= useState<string>('all')
  const [filterSession,setFilterSession] = useState<string>('all')
  const [lightbox,  setLightbox]  = useState<any>(null)
  const [toast,     setToast]     = useState<any>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadForm, setUploadForm] = useState({ type: 'after', angle: 'Face', session_label: 'J+30', notes: '' })
  const [showUpload, setShowUpload] = useState(false)

  // Comparison state
  const [sliderPos,    setSliderPos]    = useState(50)
  const [compareLeft,  setCompareLeft]  = useState<any>(null)
  const [compareRight, setCompareRight] = useState<any>(null)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  const compareRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)

    const [
      { data: pat },
      { data: ph },
      { data: sess },
      { data: trts },
      { data: comps },
    ] = await Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).single(),
      supabase.from('patient_photos').select('*, session:photo_sessions(*), treatment:treatments(name, color)')
        .eq('patient_id', patientId).order('taken_at', { ascending: false }),
      supabase.from('photo_sessions').select('*, treatment:treatments(name, color)')
        .eq('patient_id', patientId).order('session_date', { ascending: false }),
      supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id),
      supabase.from('photo_comparisons').select('*, before_photo:patient_photos!before_photo_id(*), after_photo:patient_photos!after_photo_id(*)')
        .eq('patient_id', patientId).order('created_at', { ascending: false }),
    ])

    setPatient(pat)
    setPhotos(ph ?? [])
    setSessions(sess ?? [])
    setTreatments(trts ?? [])
    setComparisons(comps ?? [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Upload handler
  async function handleFiles(files: FileList) {
    if (!files.length) return
    setUploading(true)

    // Get or create session
    let sessionId: string | null = null
    const existingSession = sessions.find(s => s.label === uploadForm.session_label)
    if (existingSession) {
      sessionId = existingSession.id
    } else {
      const { data: sess } = await supabase.from('photo_sessions').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        session_date: new Date().toISOString().split('T')[0],
        label: uploadForm.session_label,
      }).select().single()
      sessionId = sess?.id ?? null
    }

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${clinicId}/${patientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { data: upload, error: uploadError } = await supabase.storage
        .from('patient-photos').upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) { showToast(`Erreur upload: ${uploadError.message}`, false); continue }

      const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(path)

      await supabase.from('patient_photos').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        session_id: sessionId,
        url: publicUrl,
        type: uploadForm.type,
        angle: uploadForm.angle,
        notes: uploadForm.notes || null,
        taken_at: new Date().toISOString().split('T')[0],
        file_size: file.size,
      })
    }

    setUploading(false)
    setShowUpload(false)
    showToast(`✓ ${files.length} photo${files.length > 1 ? 's' : ''} uploadée${files.length > 1 ? 's' : ''}`)
    load()
  }

  async function deletePhoto(photo: any) {
    if (!confirm('Supprimer cette photo ?')) return
    // Delete from storage
    const path = photo.url.split('/patient-photos/')[1]
    if (path) await supabase.storage.from('patient-photos').remove([path])
    await supabase.from('patient_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    if (lightbox?.id === photo.id) setLightbox(null)
    showToast('Photo supprimée')
  }

  async function createComparison() {
    if (!compareLeft || !compareRight) return
    const { data } = await supabase.from('photo_comparisons').insert({
      patient_id: patientId,
      clinic_id: clinicId,
      before_photo_id: compareLeft.id,
      after_photo_id: compareRight.id,
      is_shareable: false,
    }).select().single()
    if (data) {
      setComparisons(prev => [data, ...prev])
      showToast('✓ Comparaison créée')
    }
  }

  async function toggleShare(compId: string, current: boolean) {
    await supabase.from('photo_comparisons').update({
      is_shareable: !current,
      shared_at: !current ? new Date().toISOString() : null,
    }).eq('id', compId)
    setComparisons(prev => prev.map(c => c.id === compId ? { ...c, is_shareable: !current } : c))
    if (!current) showToast('✓ Lien de partage activé')
  }

  // Slider comparison logic
  const handleSliderMove = useCallback((clientX: number) => {
    if (!compareRef.current) return
    const rect = compareRef.current.getBoundingClientRect()
    const pos = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setSliderPos(pos)
  }, [])

  useEffect(() => {
    if (!isDraggingSlider) return
    const onMove = (e: MouseEvent) => handleSliderMove(e.clientX)
    const onTouch = (e: TouchEvent) => handleSliderMove(e.touches[0].clientX)
    const onUp = () => setIsDraggingSlider(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouch)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onUp)
    }
  }, [isDraggingSlider, handleSliderMove])

  const filteredPhotos = photos.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false
    if (filterSession !== 'all' && p.session_id !== filterSession) return false
    return true
  })

  // Group by session for timeline view
  const photosBySession = sessions.map(s => ({
    ...s,
    photos: filteredPhotos.filter(p => p.session_id === s.id)
  })).filter(s => s.photos.length > 0)

  const unassigned = filteredPhotos.filter(p => !p.session_id)

  const typeCfg = (type: string) => TYPES.find(t => t.value === type) ?? TYPES[2]
  const fmt = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const beforePhotos = photos.filter(p => p.type === 'before')
  const afterPhotos  = photos.filter(p => p.type === 'after')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500, boxShadow:'0 8px 24px rgba(0,0,0,.2)' }}>{toast.msg}</div>}

      {/* Header */}
      <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
            <Link href={`/dashboard/patients/${patientId}`} style={{ color:'var(--gray-400)', textDecoration:'none' }}>
              {patient?.first_name} {patient?.last_name}
            </Link> › Photos
          </div>
          <div className="page-title">Photos médicales</div>
          <div className="page-subtitle">
            {photos.length} photo{photos.length > 1 ? 's' : ''} ·{' '}
            {beforePhotos.length} avant · {afterPhotos.length} après ·{' '}
            {sessions.length} session{sessions.length > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e => e.target.files?.length && handleFiles(e.target.files)} />
          <button onClick={() => setShowUpload(true)} className="btn-primary" style={{ fontSize:13, display:'flex', gap:6, alignItems:'center' }}>
            📸 Ajouter des photos
          </button>
        </div>
      </div>

      {/* View tabs + filters */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 28px', display:'flex', alignItems:'center', gap:0, flexShrink:0 }}>
        {([['gallery','🖼️ Galerie'],['timeline','📅 Timeline'],['compare','⚖️ Comparaison']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{ padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: view===v ? 600 : 400, color: view===v ? 'var(--blue)' : 'var(--gray-500)', borderBottom: view===v ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
        <div style={{ flex:1 }} />
        {/* Filters */}
        <div style={{ display:'flex', gap:6, padding:'8px 0' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ fontSize:12, padding:'4px 10px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer' }}>
            <option value="all">Tous types</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {sessions.length > 0 && (
            <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
              style={{ fontSize:12, padding:'4px 10px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer' }}>
              <option value="all">Toutes sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto' }}>

        {/* ── GALLERY VIEW ── */}
        {view === 'gallery' && (
          <div style={{ padding:24 }}>
            {filteredPhotos.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:80, textAlign:'center' }}>
                <div style={{ fontSize:52, marginBottom:16 }}>📷</div>
                <div style={{ fontSize:16, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>Aucune photo encore</div>
                <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:24 }}>Uploadez des photos avant/après pour suivre l'évolution du patient</div>
                <button onClick={() => setShowUpload(true)} className="btn-primary" style={{ fontSize:13 }}>Ajouter des photos</button>
              </div>
            ) : (
              <div style={{ columns: 'auto 220px', gap:12 }}>
                {filteredPhotos.map(photo => {
                  const tc = typeCfg(photo.type)
                  return (
                    <div key={photo.id} style={{ breakInside:'avoid', marginBottom:12, position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--gray-200)', cursor:'pointer', background:'var(--gray-900)' }}
                      onClick={() => setLightbox(photo)}>
                      <img src={photo.url} alt={photo.angle ?? ''} style={{ width:'100%', display:'block', objectFit:'cover' }} loading="lazy" />
                      {/* Overlay badge */}
                      <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:5 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:tc.color, background:tc.bg, padding:'2px 7px', borderRadius:99, backdropFilter:'blur(8px)' }}>{tc.label}</span>
                        {photo.angle && <span style={{ fontSize:10, background:'rgba(0,0,0,0.6)', color:'white', padding:'2px 7px', borderRadius:99 }}>{photo.angle}</span>}
                      </div>
                      {photo.session?.label && (
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent, rgba(0,0,0,0.7))', padding:'12px 8px 8px', fontSize:11, color:'rgba(255,255,255,0.9)', fontWeight:500 }}>
                          {photo.session.label}
                        </div>
                      )}
                      <button onClick={e => { e.stopPropagation(); deletePhoto(photo) }}
                        style={{ position:'absolute', top:8, right:8, width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,0.5)', border:'none', cursor:'pointer', color:'white', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', opacity:0 }}
                        className="delete-btn">✕</button>
                      <style>{`.delete-btn{transition:opacity .15s} div:hover .delete-btn{opacity:1}`}</style>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE VIEW ── */}
        {view === 'timeline' && (
          <div style={{ padding:24 }}>
            {photosBySession.length === 0 && unassigned.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, color:'var(--gray-400)', fontSize:13 }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
                Aucune photo organisée en sessions encore
              </div>
            ) : (
              <>
                {/* Sessions timeline */}
                {photosBySession.map((session, si) => (
                  <div key={session.id} style={{ marginBottom:32, position:'relative', paddingLeft:20 }}>
                    {/* Timeline line */}
                    {si < photosBySession.length - 1 && (
                      <div style={{ position:'absolute', left:10, top:32, bottom:-20, width:2, background:'var(--gray-200)' }} />
                    )}
                    {/* Session header */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background: session.treatment?.color ?? 'var(--blue)', border:'3px solid white', boxShadow:'0 0 0 2px ' + (session.treatment?.color ?? 'var(--blue)'), flexShrink:0, zIndex:1 }} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)' }}>{session.label}</div>
                        <div style={{ fontSize:12, color:'var(--gray-500)', display:'flex', gap:8 }}>
                          <span>{formatDate(session.session_date)}</span>
                          {session.treatment && <span style={{ color:session.treatment.color }}>· {session.treatment.name}</span>}
                          <span>· {session.photos.length} photo{session.photos.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    {/* Photos grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8, marginLeft:32 }}>
                      {session.photos.map((photo: any) => {
                        const tc = typeCfg(photo.type)
                        return (
                          <div key={photo.id} onClick={() => setLightbox(photo)}
                            style={{ borderRadius:10, overflow:'hidden', cursor:'pointer', position:'relative', aspectRatio:'1', background:'var(--gray-900)', border:'2px solid transparent', transition:'border-color .1s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = tc.color}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                            <img src={photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                            <div style={{ position:'absolute', top:4, left:4, fontSize:9, fontWeight:700, color:tc.color, background:tc.bg, padding:'1px 5px', borderRadius:99 }}>{tc.label}</div>
                            {photo.angle && <div style={{ position:'absolute', bottom:4, left:4, fontSize:9, background:'rgba(0,0,0,0.6)', color:'white', padding:'1px 5px', borderRadius:99 }}>{photo.angle}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Unassigned photos */}
                {unassigned.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', marginBottom:12 }}>
                      📷 Photos sans session ({unassigned.length})
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8 }}>
                      {unassigned.map(photo => {
                        const tc = typeCfg(photo.type)
                        return (
                          <div key={photo.id} onClick={() => setLightbox(photo)}
                            style={{ borderRadius:10, overflow:'hidden', cursor:'pointer', position:'relative', aspectRatio:'1', background:'var(--gray-900)' }}>
                            <img src={photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                            <div style={{ position:'absolute', top:4, left:4, fontSize:9, fontWeight:700, color:tc.color, background:tc.bg, padding:'1px 5px', borderRadius:99 }}>{tc.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── COMPARE VIEW ── */}
        {view === 'compare' && (
          <div style={{ padding:24 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
              {/* Left pick */}
              {(['before','left'] as const).map((_, i) => {
                const selected = i === 0 ? compareLeft : compareRight
                const setSelected = i === 0 ? setCompareLeft : setCompareRight
                const label = i === 0 ? '📷 Avant (gauche)' : '📷 Après (droite)'
                return (
                  <div key={i} className="card" style={{ padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:10 }}>{label}</div>
                    {selected ? (
                      <div style={{ position:'relative' }}>
                        <img src={selected.url} alt="" style={{ width:'100%', borderRadius:8, display:'block' }} />
                        <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:11, color:'var(--gray-500)' }}>{selected.session?.label ?? formatDate(selected.taken_at)} · {selected.angle}</span>
                          <button onClick={() => setSelected(null)} style={{ fontSize:11, background:'none', border:'1px solid var(--gray-200)', borderRadius:5, cursor:'pointer', padding:'2px 8px', color:'var(--gray-500)' }}>Changer</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:6, maxHeight:300, overflowY:'auto' }}>
                          {photos.map(p => (
                            <div key={p.id} onClick={() => setSelected(p)}
                              style={{ borderRadius:7, overflow:'hidden', cursor:'pointer', aspectRatio:'1', background:'var(--gray-900)', border:`2px solid ${selected?.id===p.id ? 'var(--blue)' : 'transparent'}` }}>
                              <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                            </div>
                          ))}
                        </div>
                        {photos.length === 0 && <div style={{ color:'var(--gray-400)', fontSize:12, textAlign:'center', padding:20 }}>Aucune photo disponible</div>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Slider comparison */}
            {compareLeft && compareRight ? (
              <div className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Comparaison interactive</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={createComparison} className="btn-secondary" style={{ fontSize:12 }}>
                      💾 Sauvegarder cette comparaison
                    </button>
                  </div>
                </div>
                {/* Slider container */}
                <div ref={compareRef} style={{ position:'relative', userSelect:'none', cursor:'ew-resize', borderRadius:12, overflow:'hidden', maxHeight:500 }}
                  onMouseDown={() => setIsDraggingSlider(true)}
                  onTouchStart={() => setIsDraggingSlider(true)}>
                  {/* Right (after) - full width base */}
                  <img src={compareRight.url} alt="après" style={{ width:'100%', display:'block', maxHeight:500, objectFit:'contain', background:'var(--gray-900)' }} />
                  {/* Left (before) - clipped */}
                  <div style={{ position:'absolute', inset:0, clipPath:`inset(0 ${100 - sliderPos}% 0 0)` }}>
                    <img src={compareLeft.url} alt="avant" style={{ width:'100%', height:'100%', objectFit:'contain', background:'var(--gray-900)' }} />
                  </div>
                  {/* Labels */}
                  <div style={{ position:'absolute', top:12, left:12, fontSize:12, fontWeight:700, background:'rgba(220,38,38,0.85)', color:'white', padding:'4px 10px', borderRadius:99, pointerEvents:'none' }}>Avant</div>
                  <div style={{ position:'absolute', top:12, right:12, fontSize:12, fontWeight:700, background:'rgba(5,150,222,0.85)', color:'white', padding:'4px 10px', borderRadius:99, pointerEvents:'none' }}>Après</div>
                  {/* Slider line */}
                  <div style={{ position:'absolute', top:0, bottom:0, left:`${sliderPos}%`, width:3, background:'white', transform:'translateX(-50%)', boxShadow:'0 0 8px rgba(0,0,0,.5)', pointerEvents:'none' }}>
                    {/* Handle */}
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:40, height:40, borderRadius:'50%', background:'white', boxShadow:'0 2px 12px rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      ⇔
                    </div>
                  </div>
                </div>

                {/* Slider control */}
                <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:11, color:'var(--gray-500)', minWidth:32 }}>{Math.round(sliderPos)}%</span>
                  <input type="range" value={sliderPos} onChange={e => setSliderPos(+e.target.value)} min={0} max={100} step={0.5}
                    style={{ flex:1, accentColor:'var(--blue)' }} />
                  <span style={{ fontSize:11, color:'var(--gray-500)', minWidth:60 }}>{Math.round(100-sliderPos)}%</span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>⚖️</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-600)' }}>Sélectionnez 2 photos pour comparer</div>
                <div style={{ fontSize:12, marginTop:6 }}>Choisissez une photo "avant" et une "après" dans les sélecteurs ci-dessus</div>
              </div>
            )}

            {/* Saved comparisons */}
            {comparisons.length > 0 && (
              <div style={{ marginTop:24 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:12 }}>Comparaisons sauvegardées</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
                  {comparisons.map(comp => (
                    <div key={comp.id} className="card" style={{ padding:14, display:'flex', gap:12, alignItems:'center' }}>
                      <div style={{ display:'flex', gap:4, flex:1, minWidth:0 }}>
                        <div style={{ flex:1, borderRadius:7, overflow:'hidden', position:'relative' }}>
                          {comp.before_photo && <img src={comp.before_photo.url} alt="" style={{ width:'100%', aspectRatio:'1', objectFit:'cover', display:'block' }} />}
                          <div style={{ position:'absolute', bottom:3, left:3, fontSize:9, background:'rgba(220,38,38,.85)', color:'white', padding:'1px 5px', borderRadius:99 }}>Avant</div>
                        </div>
                        <div style={{ flex:1, borderRadius:7, overflow:'hidden', position:'relative' }}>
                          {comp.after_photo && <img src={comp.after_photo.url} alt="" style={{ width:'100%', aspectRatio:'1', objectFit:'cover', display:'block' }} />}
                          <div style={{ position:'absolute', bottom:3, left:3, fontSize:9, background:'rgba(5,150,222,.85)', color:'white', padding:'1px 5px', borderRadius:99 }}>Après</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                        <button onClick={() => { setCompareLeft(comp.before_photo); setCompareRight(comp.after_photo); setSliderPos(50) }}
                          style={{ fontSize:10, padding:'4px 8px', borderRadius:6, border:'1px solid var(--blue-mid)', background:'var(--blue-light)', color:'var(--blue-dark)', cursor:'pointer', fontWeight:600 }}>
                          ↔ Voir
                        </button>
                        <button onClick={() => toggleShare(comp.id, comp.is_shareable)}
                          style={{ fontSize:10, padding:'4px 8px', borderRadius:6, border:`1px solid ${comp.is_shareable ? '#BBF7D0' : 'var(--gray-200)'}`, background: comp.is_shareable ? '#ECFDF5' : 'white', color: comp.is_shareable ? '#059669' : 'var(--gray-500)', cursor:'pointer', fontWeight:500 }}>
                          {comp.is_shareable ? '🔗 Partagé' : '🔗 Partager'}
                        </button>
                        {comp.is_shareable && (
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${comp.id}`); showToast('Lien copié') }}
                            style={{ fontSize:9, padding:'3px 6px', borderRadius:5, border:'1px solid #BBF7D0', background:'#ECFDF5', color:'#059669', cursor:'pointer' }}>
                            📋 Copier
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:480 }}>
            <div className="modal-header">
              <div className="modal-title">📸 Ajouter des photos</div>
              <button onClick={() => setShowUpload(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${dragOver ? 'var(--blue)' : 'var(--gray-200)'}`, borderRadius:12, padding:32, textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--blue-light)' : 'var(--gray-50)', transition:'all .15s' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>{uploading ? '⏳' : '📸'}</div>
                <div style={{ fontSize:13, color:'var(--gray-600)', fontWeight:500 }}>
                  {uploading ? 'Upload en cours...' : 'Glissez vos photos ici ou cliquez'}
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>JPG, PNG, HEIC · Plusieurs fichiers possibles</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="label">Type de photo</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {TYPES.map(t => (
                      <label key={t.value} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderRadius:7, cursor:'pointer', border:`1.5px solid ${uploadForm.type===t.value ? t.color : 'var(--gray-200)'}`, background: uploadForm.type===t.value ? t.bg : 'white' }}>
                        <input type="radio" name="type" value={t.value} checked={uploadForm.type===t.value} onChange={() => setUploadForm(f => ({ ...f, type: t.value }))} style={{ display:'none' }} />
                        <span style={{ fontSize:12, fontWeight:600, color: uploadForm.type===t.value ? t.color : 'var(--gray-600)' }}>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div>
                    <label className="label">Angle de vue</label>
                    <select className="input" value={uploadForm.angle} onChange={e => setUploadForm(f => ({ ...f, angle: e.target.value }))} style={{ fontSize:13 }}>
                      {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Session / Étape</label>
                    <select className="input" value={uploadForm.session_label} onChange={e => setUploadForm(f => ({ ...f, session_label: e.target.value }))} style={{ fontSize:13 }}>
                      {SESSION_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
                      {sessions.filter(s => !SESSION_LABELS.includes(s.label)).map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Note (optionnel)</label>
                    <input className="input" value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} placeholder="J+30 post-op..." style={{ fontSize:13 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowUpload(false)} className="btn-secondary">Annuler</button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary" style={{ fontSize:13 }}>
                {uploading ? 'Upload...' : '📸 Choisir les photos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', color:'white', fontSize:22, width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>

          {/* Prev/Next */}
          {filteredPhotos.indexOf(lightbox) > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(filteredPhotos[filteredPhotos.indexOf(lightbox) - 1]) }}
              style={{ position:'absolute', left:16, background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', color:'white', fontSize:24, width:44, height:44, borderRadius:'50%' }}>‹</button>
          )}
          {filteredPhotos.indexOf(lightbox) < filteredPhotos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(filteredPhotos[filteredPhotos.indexOf(lightbox) + 1]) }}
              style={{ position:'absolute', right:16, background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', color:'white', fontSize:24, width:44, height:44, borderRadius:'50%' }}>›</button>
          )}

          <div style={{ maxWidth:'85vw', maxHeight:'85vh', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }} onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt="" style={{ maxWidth:'100%', maxHeight:'75vh', objectFit:'contain', borderRadius:10, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }} />
            {/* Meta */}
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
              {(() => { const tc = typeCfg(lightbox.type); return <span style={{ fontSize:12, fontWeight:600, color:tc.color, background:tc.bg, padding:'3px 10px', borderRadius:99 }}>{tc.label}</span> })()}
              {lightbox.angle && <span style={{ fontSize:12, background:'rgba(255,255,255,0.1)', color:'white', padding:'3px 10px', borderRadius:99 }}>{lightbox.angle}</span>}
              {lightbox.session?.label && <span style={{ fontSize:12, background:'rgba(255,255,255,0.1)', color:'white', padding:'3px 10px', borderRadius:99 }}>📅 {lightbox.session.label}</span>}
              {lightbox.taken_at && <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{formatDate(lightbox.taken_at)}</span>}
              {lightbox.file_size && <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{fmt(lightbox.file_size)}</span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <a href={lightbox.url} download target="_blank"
                style={{ fontSize:12, padding:'7px 14px', borderRadius:7, background:'rgba(255,255,255,0.15)', color:'white', textDecoration:'none', fontWeight:500 }}>
                ⬇️ Télécharger
              </a>
              <button onClick={() => { setCompareLeft(lightbox); setView('compare'); setLightbox(null) }}
                style={{ fontSize:12, padding:'7px 14px', borderRadius:7, background:'rgba(5,150,222,0.3)', color:'#93C5FD', border:'none', cursor:'pointer', fontWeight:500 }}>
                ⚖️ Comparer
              </button>
              <button onClick={() => deletePhoto(lightbox)}
                style={{ fontSize:12, padding:'7px 14px', borderRadius:7, background:'rgba(220,38,38,0.2)', color:'#FCA5A5', border:'none', cursor:'pointer', fontWeight:500 }}>
                🗑 Supprimer
              </button>
            </div>
            {lightbox.notes && <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', fontStyle:'italic', textAlign:'center' }}>{lightbox.notes}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
