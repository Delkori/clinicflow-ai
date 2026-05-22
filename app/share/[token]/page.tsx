import { createClient } from '@supabase/supabase-js'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: comp } = await supabase
    .from('photo_comparisons')
    .select('*, before_photo:patient_photos!before_photo_id(*), after_photo:patient_photos!after_photo_id(*), treatment:treatments(name), patient:patients(first_name, last_name)')
    .eq('share_token', token)
    .eq('is_shareable', true)
    .single()

  if (!comp) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', background:'#0F172A', color:'white' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'48px', marginBottom:'12px' }}>🔒</div>
        <div style={{ fontSize:'18px', fontWeight:'600' }}>Lien invalide ou expiré</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0F172A', fontFamily:'system-ui', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:'28px' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.08)', padding:'6px 14px', borderRadius:'99px', marginBottom:'14px' }}>
          <div style={{ width:'20px', height:'20px', background:'#0596DE', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px' }}>ClinicFlow AI</span>
        </div>
        <h1 style={{ color:'white', fontSize:'22px', fontWeight:'700', margin:'0 0 4px', letterSpacing:'-0.3px' }}>
          Résultats {comp.treatment?.name}
        </h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'14px', margin:0 }}>
          Comparaison avant / après
        </p>
      </div>

      {/* Comparison */}
      <div style={{ width:'100%', maxWidth:'900px', borderRadius:'16px', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px', background:'#1E293B' }}>
          <div style={{ position:'relative' }}>
            <img src={comp.before_photo?.url} alt="Avant" style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block' }} />
            <div style={{ position:'absolute', bottom:'14px', left:'14px', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', color:'white', fontSize:'13px', fontWeight:'700', padding:'5px 14px', borderRadius:'8px', letterSpacing:'0.06em' }}>AVANT</div>
          </div>
          <div style={{ position:'relative' }}>
            <img src={comp.after_photo?.url} alt="Après" style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block' }} />
            <div style={{ position:'absolute', bottom:'14px', right:'14px', background:'rgba(5,150,222,0.85)', backdropFilter:'blur(8px)', color:'white', fontSize:'13px', fontWeight:'700', padding:'5px 14px', borderRadius:'8px', letterSpacing:'0.06em' }}>APRÈS</div>
          </div>
        </div>
        <div style={{ background:'#1E293B', padding:'16px 20px', textAlign:'center' }}>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'12px' }}>
            Résultats partagés par votre praticien · ClinicFlow AI
          </div>
        </div>
      </div>
    </div>
  )
}
