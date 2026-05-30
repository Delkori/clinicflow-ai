'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { use } from 'react'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [comp, setComp] = useState<any>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabasePublic
      .from('photo_comparisons')
      .select(`
        *, 
        before_photo:patient_photos!before_photo_id(*), 
        after_photo:patient_photos!after_photo_id(*),
        treatment:treatments(name, color),
        patient:patients(first_name, last_name, clinic_id)
      `)
      .eq('id', token)
      .eq('is_shareable', true)
      .single()
      .then(async ({ data }) => {
        setComp(data)
        if (data?.patient?.clinic_id) {
          const { data: c } = await supabasePublic.from('clinics').select('name').eq('id', data.patient.clinic_id).single()
          setClinic(c)
        }
        setLoading(false)
      })
  }, [token])

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pos = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setSliderPos(pos)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove  = (e: MouseEvent) => handleMove(e.clientX)
    const onTouch = (e: TouchEvent) => handleMove(e.touches[0].clientX)
    const onUp    = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [isDragging, handleMove])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F172A' }}>
      <div style={{ width:28, height:28, border:'3px solid rgba(255,255,255,0.2)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!comp) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F172A', color:'white', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🔒</div>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Lien invalide ou expiré</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>Ce lien de comparaison n'est plus disponible</div>
      </div>
    </div>
  )

  const clinicName = clinic?.name ?? 'Clinique'
  const patientInitials = `${comp.patient?.first_name?.[0] ?? ''}${comp.patient?.last_name?.[0] ?? ''}`

  return (
    <div style={{ minHeight:'100vh', background:'#0F172A', fontFamily:'-apple-system, BlinkMacSystemFont, system-ui, sans-serif', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'#0596DE', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ color:'white', fontWeight:700, fontSize:14 }}>{clinicName}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>Résultats partagés — ClinicFlow AI</div>
          </div>
        </div>
        {comp.treatment && (
          <span style={{ fontSize:12, fontWeight:600, color:comp.treatment.color, background:`${comp.treatment.color}20`, border:`1px solid ${comp.treatment.color}40`, padding:'4px 12px', borderRadius:99 }}>
            {comp.treatment.name}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
        {/* Title */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:99, padding:'5px 14px', marginBottom:14 }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'#0596DE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'white' }}>{patientInitials}</div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>Résultats avant / après</span>
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'white', margin:'0 0 8px', letterSpacing:'-0.5px' }}>
            Transformation {comp.treatment?.name ?? 'esthétique'}
          </h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', margin:0 }}>
            Faites glisser le curseur pour comparer le résultat avant et après traitement
          </p>
        </div>

        {/* Comparison slider */}
        <div style={{ width:'100%', maxWidth:720, position:'relative' }}>
          <div
            ref={containerRef}
            style={{ position:'relative', userSelect:'none', cursor:'ew-resize', borderRadius:16, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onClick={e => { const rect = containerRef.current!.getBoundingClientRect(); setSliderPos(((e.clientX - rect.left) / rect.width) * 100) }}>

            {/* After image (base) */}
            {comp.after_photo?.url && (
              <img src={comp.after_photo.url} alt="après" style={{ width:'100%', display:'block', maxHeight:'65vh', objectFit:'contain', background:'#1E293B' }} />
            )}

            {/* Before image (clipped) */}
            {comp.before_photo?.url && (
              <div style={{ position:'absolute', inset:0, clipPath:`inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={comp.before_photo.url} alt="avant" style={{ width:'100%', height:'100%', objectFit:'contain', background:'#1E293B' }} />
              </div>
            )}

            {/* Labels */}
            <div style={{ position:'absolute', top:14, left:14, fontSize:13, fontWeight:700, background:'rgba(220,38,38,0.85)', color:'white', padding:'5px 12px', borderRadius:99, backdropFilter:'blur(8px)', pointerEvents:'none' }}>
              Avant
            </div>
            <div style={{ position:'absolute', top:14, right:14, fontSize:13, fontWeight:700, background:'rgba(5,150,222,0.85)', color:'white', padding:'5px 12px', borderRadius:99, backdropFilter:'blur(8px)', pointerEvents:'none' }}>
              Après
            </div>

            {/* Watermark */}
            <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', fontSize:11, color:'rgba(255,255,255,0.45)', background:'rgba(0,0,0,0.35)', padding:'3px 10px', borderRadius:99, backdropFilter:'blur(4px)', pointerEvents:'none', whiteSpace:'nowrap' }}>
              © {clinicName} · ClinicFlow AI
            </div>

            {/* Slider line */}
            <div style={{ position:'absolute', top:0, bottom:0, left:`${sliderPos}%`, width:3, background:'white', transform:'translateX(-50%)', boxShadow:'0 0 12px rgba(0,0,0,0.5)', pointerEvents:'none' }}>
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:44, height:44, borderRadius:'50%', background:'white', boxShadow:'0 4px 16px rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#1E293B' }}>
                ⇔
              </div>
            </div>
          </div>

          {/* Slider track */}
          <div style={{ marginTop:16, padding:'0 4px' }}>
            <input type="range" min={0} max={100} step={0.5} value={sliderPos}
              onChange={e => setSliderPos(+e.target.value)}
              style={{ width:'100%', accentColor:'#0596DE' }} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>← Avant</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Après →</span>
            </div>
          </div>
        </div>

        {/* Side by side below */}
        {comp.before_photo?.url && comp.after_photo?.url && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:20, width:'100%', maxWidth:720 }}>
            {[
              { url: comp.before_photo.url, label: 'Avant', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
              { url: comp.after_photo.url,  label: 'Après', color: '#0596DE', bg: 'rgba(5,150,222,0.15)' },
            ].map(({ url, label, color, bg }) => (
              <div key={label} style={{ borderRadius:12, overflow:'hidden', border:`1px solid ${color}30`, position:'relative' }}>
                <img src={url} alt={label} style={{ width:'100%', display:'block', maxHeight:200, objectFit:'cover' }} />
                <div style={{ position:'absolute', bottom:8, left:8, fontSize:12, fontWeight:700, color, background:bg, padding:'3px 10px', borderRadius:99, backdropFilter:'blur(8px)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>
          Résultats partagés par <strong style={{ color:'rgba(255,255,255,0.5)' }}>{clinicName}</strong> · Propulsé par ClinicFlow AI · {new Date().getFullYear()}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:4 }}>
          Les résultats peuvent varier d'une personne à l'autre. Ces images sont partagées avec le consentement du patient.
        </div>
      </div>
    </div>
  )
}
