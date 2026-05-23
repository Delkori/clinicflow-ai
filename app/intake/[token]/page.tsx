'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function IntakePage() {
  const { token } = useParams()
  const [intake, setIntake]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    email: '', phone: '', date_of_birth: '',
    allergies: '', medicaments: '', antecedents: '',
    profession: '', notes: '',
  })

  useEffect(() => {
    fetch(`/api/intake?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setIntake(d.form)
          setForm(f => ({
            ...f,
            email: d.form.email ?? '',
          }))
        }
        setLoading(false)
      })
  }, [token])

  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, form_data: form }),
    })
    const data = await res.json()
    if (data.success) setSubmitted(true)
    else setError(data.error)
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ width:28, height:28, border:'3px solid #E2E8F0', borderTopColor:'#0596DE', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F172A', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ textAlign:'center', color:'white', padding:24 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <h1 style={{ fontSize:20, fontWeight:600, marginBottom:8 }}>Formulaire indisponible</h1>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14 }}>{error}</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ background:'white', borderRadius:20, padding:48, maxWidth:440, textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 20px' }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8, color:'#0F172A' }}>Dossier complété !</h2>
        <p style={{ fontSize:15, color:'#64748B', lineHeight:1.7 }}>Vos informations ont bien été transmises à votre clinique. Merci !</p>
      </div>
    </div>
  )

  const clinicName = intake?.clinic?.name ?? 'Votre clinique'

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'28px 24px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.08)', padding:'6px 14px', borderRadius:99, marginBottom:14 }}>
          <div style={{ width:18, height:18, background:'#0596DE', borderRadius:4 }} />
          <span style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>ClinicFlow AI</span>
        </div>
        <h1 style={{ color:'white', fontSize:22, fontWeight:700, margin:'0 0 4px' }}>{clinicName}</h1>
        <p style={{ color:'rgba(255,255,255,0.55)', fontSize:14, margin:0 }}>Complétez votre dossier patient</p>
      </div>

      <div style={{ maxWidth:540, margin:'0 auto', padding:'28px 20px' }}>
        {/* Welcome card */}
        <div style={{ background:'white', borderRadius:14, padding:'18px 20px', marginBottom:20, border:'1px solid #E2E8F0', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span style={{ fontSize:24, flexShrink:0 }}>👋</span>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:'#0F172A', marginBottom:4 }}>
              Bonjour {intake?.first_name} {intake?.last_name}
            </div>
            <div style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>
              Votre clinique vous invite à compléter votre dossier médical avant votre rendez-vous. Ces informations resteront strictement confidentielles.
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Contact */}
          <div style={{ background:'white', borderRadius:14, padding:20, border:'1px solid #E2E8F0' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#0F172A', marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
              📞 Coordonnées
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Email</label>
                <input value={form.email} onChange={up('email')} type="email" placeholder="votre@email.fr"
                  style={{ width:'100%', padding:'10px 14px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Téléphone</label>
                  <input value={form.phone} onChange={up('phone')} type="tel" placeholder="06 12 34 56 78"
                    style={{ width:'100%', padding:'10px 14px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Date de naissance</label>
                  <input value={form.date_of_birth} onChange={up('date_of_birth')} type="date"
                    style={{ width:'100%', padding:'10px 14px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Profession</label>
                <input value={form.profession} onChange={up('profession')} placeholder="Votre profession..."
                  style={{ width:'100%', padding:'10px 14px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
          </div>

          {/* Medical */}
          <div style={{ background:'white', borderRadius:14, padding:20, border:'1px solid #E2E8F0' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#0F172A', marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
              🩺 Informations médicales
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'allergies', label:'⚠️ Allergies connues', placeholder:'Pénicilline, latex, arachides...', important: true },
                { key:'medicaments', label:'💊 Médicaments en cours', placeholder:'Nom, dosage, fréquence...' },
                { key:'antecedents', label:'📋 Antécédents médicaux', placeholder:'Maladies, opérations, hospitalisations...' },
                { key:'notes', label:'📝 Informations complémentaires', placeholder:'Tout ce que vous souhaitez communiquer à votre médecin...' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color: f.important ? '#DC2626' : '#475569', marginBottom:5 }}>
                    {f.label}
                    {f.important && <span style={{ fontSize:10, background:'#FEF2F2', color:'#DC2626', padding:'1px 6px', borderRadius:3, marginLeft:6, fontWeight:700 }}>IMPORTANT</span>}
                  </label>
                  <textarea value={(form as any)[f.key]} onChange={up(f.key)} placeholder={f.placeholder} rows={2}
                    style={{ width:'100%', padding:'10px 14px', border:`1px solid ${f.important && (form as any)[f.key] ? '#FECACA' : '#E2E8F0'}`, borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.6 }} />
                </div>
              ))}
            </div>
          </div>

          {/* RGPD notice */}
          <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, padding:'12px 14px', fontSize:12, color:'#64748B', lineHeight:1.6 }}>
            🔒 Vos données sont transmises de façon sécurisée à <strong>{clinicName}</strong> et ne sont utilisées qu'à des fins médicales, conformément au RGPD.
          </div>

          <button type="submit" disabled={submitting}
            style={{ padding:'14px', borderRadius:12, border:'none', background: submitting ? '#E2E8F0' : '#0596DE', color:'white', fontSize:15, fontWeight:700, cursor: submitting ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all .15s' }}>
            {submitting ? 'Envoi en cours...' : '✓ Envoyer mon dossier'}
          </button>
        </form>
      </div>
    </div>
  )
}
