'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STEPS = [
  { id:'clinic',      icon:'🏥', title:'Votre clinique',     desc:'Informations de base' },
  { id:'treatment',   icon:'💊', title:'Premier traitement', desc:'Choisissez votre spécialité' },
  { id:'workflow',    icon:'⚡', title:'Premier workflow',   desc:'Automatisation en 1 clic' },
  { id:'booking',     icon:'📅', title:'Page de réservation',desc:'Lien à partager aux patients' },
  { id:'done',        icon:'🎉', title:'C\'est parti !',      desc:'Votre clinique est prête' },
]

const TREATMENT_TEMPLATES = [
  { id:'greffe', icon:'💈', label:'Greffe capillaire', color:'#1D4ED8' },
  { id:'injection', icon:'💉', label:'Injections HA / Botox', color:'#7C3AED' },
  { id:'laser', icon:'⚡', label:'Laser / Peeling', color:'#DC2626' },
  { id:'corps', icon:'🧘', label:'Médecine du corps', color:'#059669' },
]

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep]         = useState(0)
  const [clinicName, setClinicName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [clinicId, setClinicId] = useState('')
  const [bookingSlug, setBookingSlug] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*, clinic:clinics(name, id)').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      const name = (prof as any).clinic?.name ?? ''
      setClinicName(name)
      setDoctorName(prof.full_name ?? '')

      // Check onboarding progress
      const { data: progress } = await supabase.from('onboarding_progress').select('*').eq('clinic_id', prof.clinic_id).single()
      if (progress?.is_completed) { router.push('/dashboard'); return }
      if (progress?.completed_steps) setCompletedSteps(progress.completed_steps)

      // Get booking slug
      const { data: bs } = await supabase.from('booking_settings').select('slug').eq('clinic_id', prof.clinic_id).single()
      if (bs) setBookingSlug(bs.slug)
    }
    load()
  }, [])

  async function markStep(stepId: string) {
    const newSteps = Array.from(new Set([...completedSteps, stepId]))
    setCompletedSteps(newSteps)
    await supabase.from('onboarding_progress').upsert({
      clinic_id: clinicId, completed_steps: newSteps,
      is_completed: newSteps.length >= 4,
    })
  }

  async function saveClinic() {
    setSaving(true)
    await supabase.from('clinics').update({ name: clinicName }).eq('id', clinicId)
    await supabase.from('profiles').update({ full_name: doctorName }).eq('clinic_id', clinicId)
    await markStep('clinic')
    setSaving(false)
    setStep(1)
  }

  async function saveTreatments() {
    setSaving(true)
    for (const t of selectedTreatments) {
      const colors: Record<string,string> = { greffe:'#1D4ED8', injection:'#7C3AED', laser:'#DC2626', corps:'#059669' }
      const names: Record<string,string> = { greffe:'Greffe capillaire FUE', injection:'Injections HA / Botox', laser:'Laser & Peeling', corps:'Médecine esthétique corps' }
      await supabase.from('treatments').insert({ clinic_id: clinicId, name: names[t], color: colors[t] }).select()
    }
    await markStep('treatment')
    setSaving(false)
    setStep(2)
  }

  async function createFirstWorkflow() {
    setSaving(true)
    // Get first treatment
    const { data: treatments } = await supabase.from('treatments').select('id,name').eq('clinic_id', clinicId).limit(1)
    const t = treatments?.[0]

    await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId,
      name: `Parcours ${t?.name ?? 'patient'} automatique`,
      description: 'Workflow créé automatiquement lors du démarrage',
      trigger_type: 'consultation_created',
      is_active: false,
      nodes: [
        { id:'trigger', type:'trigger', label:'Consultation créée', icon:'⚡', x:80, y:180, config:{} },
        { id:'email_1', type:'email', label:'Email de bienvenue', icon:'📧', x:300, y:180, config:{ subject:'Merci pour votre consultation — {{clinic_name}}', body:'Bonjour {{first_name}},\n\nMerci pour votre consultation. Nous allons revenir vers vous rapidement.\n\nCordialement,\n{{clinic_name}}' } },
        { id:'delay', type:'delay', label:'Attendre J+3', icon:'⏰', x:520, y:180, config:{ days:3 } },
        { id:'wa', type:'whatsapp', label:'Suivi J+3', icon:'💬', x:740, y:180, config:{ body:'Bonjour {{first_name}}, comment vous sentez-vous depuis votre consultation ? Des questions ?' } },
      ],
      edges: [
        { from:'trigger', to:'email_1' },
        { from:'email_1', to:'delay' },
        { from:'delay', to:'wa' },
      ],
    })
    await markStep('workflow')
    setSaving(false)
    setStep(3)
  }

  async function finishOnboarding() {
    await markStep('booking')
    await supabase.from('onboarding_progress').update({ is_completed: true }).eq('clinic_id', clinicId)
    router.push('/dashboard')
  }

  const currentStep = STEPS[step]
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://clinicflow-ai-delkoris-projects.vercel.app'

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:560 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.06)', padding:'8px 16px', borderRadius:99, border:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width:22, height:22, background:'#0596DE', borderRadius:5 }} />
            <span style={{ color:'white', fontWeight:700, fontSize:14 }}>ClinicFlow AI</span>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:0, marginBottom:28 }}>
          {STEPS.slice(0,4).map((s, i) => (
            <div key={s.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
                {i > 0 && <div style={{ flex:1, height:2, background: step > i ? '#0596DE' : 'rgba(255,255,255,0.1)' }} />}
                <div style={{ width:28, height:28, borderRadius:'50%', background: step > i ? '#0596DE' : step === i ? 'rgba(5,150,222,0.3)' : 'rgba(255,255,255,0.07)', border: `2px solid ${step >= i ? '#0596DE' : 'rgba(255,255,255,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'white', fontWeight:700, flexShrink:0, zIndex:1 }}>
                  {step > i ? '✓' : i+1}
                </div>
                {i < 3 && <div style={{ flex:1, height:2, background: step > i ? '#0596DE' : 'rgba(255,255,255,0.1)' }} />}
              </div>
              <div style={{ fontSize:10, color: step === i ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', fontWeight: step === i ? 600 : 400, textAlign:'center' }}>{s.title}</div>
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background:'white', borderRadius:20, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>
          {/* Card header */}
          <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'24px 28px' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{currentStep.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:'white', letterSpacing:'-0.3px' }}>{currentStep.title}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginTop:3 }}>{currentStep.desc}</div>
          </div>

          <div style={{ padding:28 }}>
            {/* Step 0: Clinic info */}
            {step === 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:5 }}>Nom de la clinique *</label>
                  <input className="input" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Clinique Esthétique Paris 8" />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:5 }}>Votre nom (Dr) *</label>
                  <input className="input" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr Marie Dupont" />
                </div>
                <button onClick={saveClinic} disabled={saving || !clinicName || !doctorName} className="btn-primary" style={{ width:'100%', padding:13, fontSize:14, justifyContent:'center', marginTop:4 }}>
                  {saving ? 'Sauvegarde...' : 'Continuer →'}
                </button>
              </div>
            )}

            {/* Step 1: Treatments */}
            {step === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={{ fontSize:13, color:'#64748B', margin:'0 0 8px' }}>Sélectionnez vos spécialités (plusieurs possibles) :</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {TREATMENT_TEMPLATES.map(t => {
                    const sel = selectedTreatments.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => setSelectedTreatments(prev => sel ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                        style={{ padding:'14px 12px', borderRadius:10, border:`2px solid ${sel ? t.color : '#E2E8F0'}`, background: sel ? `${t.color}10` : 'white', cursor:'pointer', textAlign:'left', transition:'all .1s' }}>
                        <div style={{ fontSize:20, marginBottom:5 }}>{t.icon}</div>
                        <div style={{ fontSize:13, fontWeight:600, color: sel ? t.color : '#0F172A' }}>{t.label}</div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button onClick={() => setStep(2)} style={{ flex:1, padding:11, borderRadius:9, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', fontSize:13, color:'#64748B' }}>Passer cette étape</button>
                  <button onClick={saveTreatments} disabled={saving || !selectedTreatments.length} className="btn-primary" style={{ flex:2, padding:11, justifyContent:'center', fontSize:14 }}>
                    {saving ? 'Création...' : `Créer ${selectedTreatments.length} traitement${selectedTreatments.length > 1 ? 's' : ''} →`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: First workflow */}
            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:'#F8FAFC', borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>On va créer ce workflow pour vous :</div>
                  {[
                    { icon:'⚡', label:'Consultation créée', color:'#D97706' },
                    { icon:'📧', label:'Email de bienvenue', color:'#1D4ED8' },
                    { icon:'⏰', label:'Attendre 3 jours', color:'#0596DE' },
                    { icon:'💬', label:'WhatsApp de suivi', color:'#166534' },
                  ].map((n,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:7, background:'white', marginBottom:5, border:`1px solid ${n.color}20` }}>
                      <span style={{ fontSize:14 }}>{n.icon}</span>
                      <span style={{ fontSize:12.5, fontWeight:600, color:n.color }}>{n.label}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:12, color:'#94A3B8', margin:0 }}>Vous pourrez le personnaliser dans le builder de workflows</p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { markStep('workflow'); setStep(3) }} style={{ flex:1, padding:11, borderRadius:9, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', fontSize:13, color:'#64748B' }}>Passer</button>
                  <button onClick={createFirstWorkflow} disabled={saving} className="btn-primary" style={{ flex:2, padding:11, justifyContent:'center', fontSize:14 }}>
                    {saving ? 'Création...' : '⚡ Créer ce workflow →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Booking */}
            {step === 3 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <p style={{ fontSize:14, color:'#475569', lineHeight:1.6 }}>Votre page de réservation est prête. Partagez ce lien à vos patients :</p>
                <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:9, padding:'12px 14px', display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:18 }}>🔗</span>
                  <code style={{ fontSize:12, color:'#166534', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', userSelect:'all' }}>
                    {baseUrl}/rdv/{bookingSlug || 'ma-clinique'}
                  </code>
                  <button onClick={() => navigator.clipboard.writeText(`${baseUrl}/rdv/${bookingSlug || 'ma-clinique'}`)}
                    style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid #BBF7D0', background:'white', cursor:'pointer', color:'#166534', fontWeight:600, flexShrink:0 }}>
                    Copier
                  </button>
                </div>
                <a href={`${baseUrl}/rdv/${bookingSlug || 'ma-clinique'}`} target="_blank"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:11, borderRadius:9, border:'1px solid #E2E8F0', background:'white', color:'#0596DE', textDecoration:'none', fontSize:13, fontWeight:600 }}>
                  👁 Voir ma page →
                </a>
                <button onClick={finishOnboarding} className="btn-primary" style={{ width:'100%', padding:14, fontSize:14, justifyContent:'center' }}>
                  🎉 C'est parti — Accéder au dashboard →
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:16 }}>
          <Link href="/dashboard" style={{ fontSize:12, color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>Passer l'onboarding →</Link>
        </div>
      </div>
    </div>
  )
}
