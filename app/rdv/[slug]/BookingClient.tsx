'use client'
import { useState } from 'react'

const DAYS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function generateTimeSlots(startH: number, endH: number, duration: number): string[] {
  const slots: string[] = []
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += duration) {
      slots.push(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`)
    }
  }
  return slots
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}

export default function BookingClient({ settings }: { settings: any }) {
  const color = settings.primary_color ?? '#0596DE'
  const clinicName = settings.clinic?.name ?? settings.title ?? 'Clinique'
  const appointmentTypes = settings.appointment_types ?? [
    { id:'consultation', label:'Consultation initiale', duration:30 },
    { id:'bilan', label:'Bilan & devis', duration:45 },
  ]
  const treatments = (settings.treatments ?? []).filter((t: any) => t)

  const today = new Date()
  const [step, setStep]           = useState<1|2|3|4>(1)
  const [apptType, setApptType]   = useState('')
  const [treatmentId, setTreatmentId] = useState('')
  const [calMonth, setCalMonth]   = useState(today.getMonth())
  const [calYear, setCalYear]     = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date|null>(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [form, setForm]           = useState({ first_name:'', last_name:'', email:'', phone:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]  = useState(false)

  const upForm = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const calDays = getCalendarDays(calYear, calMonth)
  const selectedType = appointmentTypes.find((t: any) => t.id === apptType)
  const duration = selectedType?.duration ?? 30
  const timeSlots = generateTimeSlots(9, 18, duration)

  function isPastDay(day: number) {
    const d = new Date(calYear, calMonth, day)
    d.setHours(0,0,0,0)
    const t = new Date(); t.setHours(0,0,0,0)
    return d <= t
  }

  function isWeekend(day: number) {
    const d = new Date(calYear, calMonth, day)
    return d.getDay() === 0 || d.getDay() === 6
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) }
    else setCalMonth(m => m-1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) }
    else setCalMonth(m => m+1)
  }

  async function submit() {
    if (!selectedDate || !selectedTime || !form.first_name || !form.last_name || !form.email) return
    setSubmitting(true)
    await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id: settings.clinic_id,
        booking_setting_id: settings.id,
        ...form,
        requested_date: `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`,
        requested_time: selectedTime,
        appointment_type: apptType || 'consultation',
        treatment_id: treatmentId || null,
      }),
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ background:`linear-gradient(135deg, #0F172A, #1E293B)`, padding:'32px 24px', textAlign:'center' }}>
        <h1 style={{ color:'white', fontSize:22, fontWeight:700, margin:0 }}>{clinicName}</h1>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ background:'white', borderRadius:20, padding:48, maxWidth:460, textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.08)', width:'100%' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 20px' }}>✅</div>
          <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 10px', color:'#0F172A' }}>Demande envoyée !</h2>
          <p style={{ fontSize:15, color:'#64748B', lineHeight:1.7, marginBottom:24 }}>
            Votre demande de rendez-vous a bien été reçue.<br />
            Notre équipe vous confirmera par email sous 24h.
          </p>
          <div style={{ background:'#F8FAFC', borderRadius:12, padding:'16px 20px', textAlign:'left', marginBottom:24 }}>
            <div style={{ fontSize:13, color:'#64748B', marginBottom:4 }}>Date souhaitée</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#0F172A' }}>
              {selectedDate?.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })} à {selectedTime}
            </div>
          </div>
          <p style={{ fontSize:13, color:'#94A3B8' }}>Un email de confirmation vous a été envoyé à <strong>{form.email}</strong></p>
        </div>
      </div>
    </div>
  )

  const stepLabels = ['Type', 'Date', 'Horaire', 'Vos infos']

  return (
    <div style={{ minHeight:'100vh', fontFamily:'system-ui, -apple-system, sans-serif', background:'#F8FAFC' }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, #0F172A, #1E293B)`, padding:'32px 24px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.08)', padding:'6px 14px', borderRadius:99, marginBottom:16 }}>
          <div style={{ width:20, height:20, borderRadius:5, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>ClinicFlow AI</span>
        </div>
        <h1 style={{ color:'white', fontSize:24, fontWeight:800, letterSpacing:'-0.3px', margin:'0 0 6px' }}>{clinicName}</h1>
        {settings.description && <p style={{ color:'rgba(255,255,255,0.55)', fontSize:14, maxWidth:440, margin:'0 auto', lineHeight:1.6 }}>{settings.description}</p>}
      </div>

      {/* Progress */}
      <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'14px 24px' }}>
        <div style={{ maxWidth:580, margin:'0 auto', display:'flex', alignItems:'center', gap:0 }}>
          {stepLabels.map((label, i) => {
            const sn = (i+1) as 1|2|3|4
            const done = step > sn
            const active = step === sn
            return (
              <div key={i} style={{ flex:1, display:'flex', alignItems:'center', gap:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, background: done ? color : active ? `${color}20` : '#F1F5F9', color: done ? 'white' : active ? color : '#94A3B8', border: active ? `2px solid ${color}` : done ? 'none' : 'none', transition:'all .2s' }}>
                    {done ? '✓' : sn}
                  </div>
                  <span style={{ fontSize:12, fontWeight: active ? 600 : 400, color: active ? '#0F172A' : done ? '#64748B' : '#94A3B8', whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {i < 3 && <div style={{ flex:1, height:2, background: done ? color : '#E2E8F0', margin:'0 8px', transition:'background .3s', minWidth:16 }} />}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth:580, margin:'0 auto', padding:'24px 20px' }}>

        {/* Step 1: Type */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6, color:'#0F172A' }}>Quel type de rendez-vous ?</h2>
            <p style={{ fontSize:14, color:'#64748B', marginBottom:20 }}>Sélectionnez le motif de votre consultation</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {appointmentTypes.map((t: any) => (
                <div key={t.id} onClick={() => setApptType(t.id)}
                  style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${apptType===t.id ? color : '#E2E8F0'}`, background: apptType===t.id ? `${color}08` : 'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:600, color:'#0F172A', marginBottom:2 }}>{t.label}</div>
                    <div style={{ fontSize:12, color:'#64748B' }}>⏱ {t.duration} minutes</div>
                  </div>
                  <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${apptType===t.id ? color : '#CBD5E1'}`, background: apptType===t.id ? color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {apptType===t.id && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }} />}
                  </div>
                </div>
              ))}
            </div>

            {treatments.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:8 }}>Traitement souhaité (optionnel)</label>
                <select value={treatmentId} onChange={e => setTreatmentId(e.target.value)}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E8F0', fontSize:14, background:'white', color:'#0F172A', outline:'none', fontFamily:'inherit' }}>
                  <option value="">— Je ne sais pas encore</option>
                  {treatments.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <button disabled={!apptType} onClick={() => setStep(2)}
              style={{ width:'100%', padding:'14px', borderRadius:10, border:'none', background: apptType ? color : '#E2E8F0', color: apptType ? 'white' : '#94A3B8', fontSize:15, fontWeight:600, cursor: apptType ? 'pointer' : 'not-allowed', transition:'all .15s' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6, color:'#0F172A' }}>Choisissez une date</h2>
            <p style={{ fontSize:14, color:'#64748B', marginBottom:20 }}>Sélectionnez votre jour préféré</p>

            <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', marginBottom:16 }}>
              {/* Calendar nav */}
              <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #F1F5F9' }}>
                <button onClick={prevMonth} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', fontSize:14 }}>‹</button>
                <span style={{ fontSize:15, fontWeight:600, color:'#0F172A', textTransform:'capitalize' }}>{MONTHS_FR[calMonth]} {calYear}</span>
                <button onClick={nextMonth} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', fontSize:14 }}>›</button>
              </div>
              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:0, padding:'10px 12px 4px' }}>
                {['L','M','M','J','V','S','D'].map((d,i) => (
                  <div key={i} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:'#94A3B8', padding:'4px 0' }}>{d}</div>
                ))}
              </div>
              {/* Days */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'4px 12px 14px' }}>
                {calDays.map((day, i) => {
                  if (!day) return <div key={i} />
                  const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === calMonth && selectedDate?.getFullYear() === calYear
                  const disabled = isPastDay(day) || isWeekend(day)
                  return (
                    <button key={i} disabled={disabled}
                      onClick={() => setSelectedDate(new Date(calYear, calMonth, day))}
                      style={{ height:36, borderRadius:8, border:'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize:13, fontWeight: isSelected ? 700 : 400, background: isSelected ? color : 'transparent', color: isSelected ? 'white' : disabled ? '#CBD5E1' : '#0F172A', transition:'all .1s' }}
                      onMouseEnter={e => { if (!disabled && !isSelected) e.currentTarget.style.background = `${color}15` }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, padding:'13px', borderRadius:10, border:'1px solid #E2E8F0', background:'white', color:'#475569', fontSize:14, fontWeight:500, cursor:'pointer' }}>← Retour</button>
              <button disabled={!selectedDate} onClick={() => setStep(3)}
                style={{ flex:2, padding:'13px', borderRadius:10, border:'none', background: selectedDate ? color : '#E2E8F0', color: selectedDate ? 'white' : '#94A3B8', fontSize:14, fontWeight:600, cursor: selectedDate ? 'pointer' : 'not-allowed' }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4, color:'#0F172A' }}>Choisissez un horaire</h2>
            <p style={{ fontSize:14, color:'#64748B', marginBottom:20 }}>
              {selectedDate?.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })} — Durée : {duration} min
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
              {timeSlots.map(time => (
                <button key={time} onClick={() => setSelectedTime(time)}
                  style={{ padding:'11px 6px', borderRadius:9, border:`1.5px solid ${selectedTime===time ? color : '#E2E8F0'}`, background: selectedTime===time ? color : 'white', color: selectedTime===time ? 'white' : '#0F172A', fontSize:14, fontWeight: selectedTime===time ? 600 : 400, cursor:'pointer', transition:'all .12s' }}>
                  {time}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep(2)} style={{ flex:1, padding:'13px', borderRadius:10, border:'1px solid #E2E8F0', background:'white', color:'#475569', fontSize:14, cursor:'pointer' }}>← Retour</button>
              <button disabled={!selectedTime} onClick={() => setStep(4)}
                style={{ flex:2, padding:'13px', borderRadius:10, border:'none', background: selectedTime ? color : '#E2E8F0', color: selectedTime ? 'white' : '#94A3B8', fontSize:14, fontWeight:600, cursor: selectedTime ? 'pointer' : 'not-allowed' }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Info */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4, color:'#0F172A' }}>Vos coordonnées</h2>
            <div style={{ background:'white', borderRadius:12, border:`1px solid ${color}30`, padding:'14px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📅</div>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#0F172A' }}>{selectedDate?.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })} à {selectedTime}</div>
                <div style={{ fontSize:12, color:'#64748B' }}>{selectedType?.label} · {duration} minutes</div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Prénom *</label>
                  <input className="input" value={form.first_name} onChange={upForm('first_name')} required placeholder="Marie" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Nom *</label>
                  <input className="input" value={form.last_name} onChange={upForm('last_name')} required placeholder="Dupont" />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Email *</label>
                <input className="input" type="email" value={form.email} onChange={upForm('email')} required placeholder="marie.dupont@email.fr" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Téléphone</label>
                <input className="input" type="tel" value={form.phone} onChange={upForm('phone')} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5 }}>Message / Notes (optionnel)</label>
                <textarea value={form.notes} onChange={upForm('notes')} placeholder="Précisez votre demande..." rows={3}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:9, border:'1px solid #E2E8F0', fontSize:14, fontFamily:'inherit', resize:'none', outline:'none' }} />
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep(3)} style={{ flex:1, padding:'13px', borderRadius:10, border:'1px solid #E2E8F0', background:'white', color:'#475569', fontSize:14, cursor:'pointer' }}>← Retour</button>
              <button disabled={submitting || !form.first_name || !form.last_name || !form.email} onClick={submit}
                style={{ flex:2, padding:'13px', borderRadius:10, border:'none', background: form.first_name && form.last_name && form.email ? color : '#E2E8F0', color: form.first_name && form.last_name && form.email ? 'white' : '#94A3B8', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {submitting ? 'Envoi...' : '✓ Confirmer ma demande'}
              </button>
            </div>

            <p style={{ fontSize:11, color:'#94A3B8', textAlign:'center', marginTop:12 }}>
              Votre demande sera confirmée par email dans les 24h par notre équipe.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
