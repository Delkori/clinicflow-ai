'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function NewConsultationPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <ConsultationForm />
    </Suspense>
  )
}

function ConsultationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [patients, setPatients]   = useState<any[]>([])
  const [actes, setActes]         = useState<any[]>([])
  const [clinicId, setClinicId]   = useState('')
  const [patientId, setPatientId] = useState(searchParams.get('patient_id') ?? '')
  const [acteId, setActeId]       = useState('')
  const [selectedActe, setSelectedActe] = useState<any>(null)
  const [step, setStep]           = useState<1|2|3>(1)
  const [saving, setSaving]       = useState(false)

  // Standard fields
  const [motif, setMotif]               = useState('')
  const [antecedents, setAntecedents]   = useState({ medical: '', chirurgical: '', allergie: '', medicaments: '', tabac: '', grossesse: '' })
  const [contraindications, setCi]      = useState<string[]>([])
  const [notes, setNotes]               = useState('')
  const [devisMontant, setDevis]        = useState('')

  // Dynamic fields from acte
  const [acteFields, setActeFields]     = useState<Record<string,any>>({})

  // Audio
  const [recording, setRecording]       = useState(false)
  const [audioBlob, setAudioBlob]       = useState<Blob|null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [aiDone, setAiDone]             = useState(false)
  const mrRef = useRef<MediaRecorder|null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recTime, setRecTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout|null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return
      setClinicId(prof.clinic_id)
      const [{ data: pts }, { data: acts }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').order('last_name'),
        supabase.from('actes_catalogue').select('*').eq('clinic_id', prof.clinic_id).eq('is_active', true).order('categorie'),
      ])
      setPatients(pts ?? [])
      setActes(acts ?? [])
    }
    load()
  }, [])

  function selectActe(id: string) {
    setActeId(id)
    const acte = actes.find(a => a.id === id)
    setSelectedActe(acte ?? null)
    setActeFields({})
  }

  // Recording
  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4'
    const mr = new MediaRecorder(stream, { mimeType: mime })
    mrRef.current = mr; chunksRef.current = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      setAudioBlob(blob)
      stream.getTracks().forEach(t => t.stop())
    }
    mr.start(1000); setRecording(true); setRecTime(0)
    timerRef.current = setInterval(() => setRecTime(t => t+1), 1000)
  }

  function stopRec() {
    mrRef.current?.stop(); setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  async function transcribeAndFill() {
    if (!audioBlob) return
    setTranscribing(true)
    const fd = new FormData()
    fd.append('audio', new File([audioBlob], 'consult.webm', { type: audioBlob.type }))
    const res = await fetch('/api/ai/transcribe', { method:'POST', body: fd })
    const { transcription } = await res.json()
    if (transcription) {
      // Try to extract relevant fields from transcription via AI
      const structRes = await fetch('/api/ai/structure', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ transcription, treatment: selectedActe?.nom })
      })
      const { structured } = await structRes.json()
      if (structured?.motif_consultation) setMotif(structured.motif_consultation)
      if (structured?.antecedents) setAntecedents(a => ({ ...a, medical: structured.antecedents }))
      if (structured?.medicaments)  setAntecedents(a => ({ ...a, medicaments: structured.medicaments }))
      if (structured?.allergies)    setAntecedents(a => ({ ...a, allergie: structured.allergies }))
      if (structured?.notes)        setNotes(structured.notes)
      setAiDone(true)
    }
    setTranscribing(false)
  }

  async function handleSave() {
    if (!patientId || !clinicId) return
    setSaving(true)
    const acte = actes.find(a => a.id === acteId)
    const { data: consult, error } = await supabase.from('consultations').insert({
      patient_id: patientId, clinic_id: clinicId,
      treatment_id: acte ? null : null,
      acte_type: acte?.nom ?? null,
      structured_data: {
        motif_consultation: motif,
        antecedents: antecedents.medical,
        antecedents_chirurgicaux: antecedents.chirurgical,
        allergies: antecedents.allergie,
        medicaments: antecedents.medicaments,
        tabac: antecedents.tabac,
        notes,
        ...acteFields,
      },
      contre_indications: contraindications.length > 0 ? contraindications : null,
      devis_montant: devisMontant ? parseFloat(devisMontant) : null,
      status: 'completed',
    }).select().single()
    setSaving(false)
    if (!error && consult) {
      // Trigger workflows
      await fetch('/api/flows/trigger', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ trigger_type:'consultation_created', clinic_id: clinicId, patient_id: patientId, trigger_data: { acte: acte?.nom } }),
      })
      router.push(`/dashboard/consultations/${consult.id}`)
    }
  }

  const CATEGORIES: Record<string, {label:string;icon:string;color:string}> = {
    capillaire: { label:'Capillaire', icon:'💈', color:'#1D4ED8' },
    injections:  { label:'Injections', icon:'💉', color:'#7C3AED' },
    laser:       { label:'Laser',      icon:'⚡', color:'#DC2626' },
    peeling:     { label:'Peeling',    icon:'✨', color:'#059669' },
    chirurgie:   { label:'Chirurgie',  icon:'🔬', color:'#D97706' },
    corps:       { label:'Corps',      icon:'🧘', color:'#0891B2' },
    visage:      { label:'Visage',     icon:'🪞', color:'#EC4899' },
    autre:       { label:'Autre',      icon:'📋', color:'#475569' },
  }

  const groupedActes = actes.reduce((acc, a) => {
    if (!acc[a.categorie]) acc[a.categorie] = []
    acc[a.categorie].push(a)
    return acc
  }, {} as Record<string,any[]>)

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
            <Link href="/dashboard/consultations" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Consultations</Link> › Nouvelle
          </div>
          <div className="page-title">Nouvelle consultation</div>
        </div>
        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {[['1','Patient & Acte'],['2','Examen'],['3','Résumé']].map(([n,l],i) => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, background: step > i+1 ? 'var(--blue)' : step === i+1 ? 'var(--blue)' : 'var(--gray-200)', color: step >= i+1 ? 'white' : 'var(--gray-400)' }}>{step > i+1 ? '✓' : n}</div>
              <span style={{ fontSize:12, color: step === i+1 ? 'var(--gray-900)' : 'var(--gray-400)', fontWeight: step === i+1 ? 600 : 400 }}>{l}</span>
              {i < 2 && <div style={{ width:20, height:2, background: step > i+1 ? 'var(--blue)' : 'var(--gray-200)', borderRadius:1 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'0 32px 32px' }}>

        {/* ── STEP 1: Patient + Acte ── */}
        {step === 1 && (
          <div style={{ maxWidth:720, display:'flex', flexDirection:'column', gap:16 }}>
            {/* Patient selector */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:14 }}>👤 Patient</div>
              <select className="input" value={patientId} onChange={e => setPatientId(e.target.value)} required>
                <option value="">Sélectionner un patient...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
              </select>
            </div>

            {/* Acte selector */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:14 }}>🩺 Acte / Traitement</div>
              {Object.entries(groupedActes).map(([cat, acts]) => {
                const cc = CATEGORIES[cat] ?? CATEGORIES.autre
                return (
                  <div key={cat} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:cc.color, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                      {cc.icon} {cc.label}
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {(acts as any[]).map(a => (
                        <button key={a.id} onClick={() => selectActe(a.id)}
                          style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${acteId===a.id ? cc.color : 'var(--gray-200)'}`, background: acteId===a.id ? `${cc.color}12` : 'white', color: acteId===a.id ? cc.color : 'var(--gray-700)', fontSize:13, fontWeight: acteId===a.id ? 600 : 400, cursor:'pointer', transition:'all .1s' }}>
                          {a.nom}
                          {a.prix_base && <span style={{ fontSize:10, marginLeft:6, opacity:.7 }}>{a.prix_base}€</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {selectedActe?.instructions_pre && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
                  <strong>⚠️ Pré-requis pour {selectedActe.nom} :</strong><br />{selectedActe.instructions_pre}
                </div>
              )}
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setStep(2)} disabled={!patientId} className="btn-primary" style={{ fontSize:13 }}>
                Continuer → Examen clinique
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Examen clinique ── */}
        {step === 2 && (
          <div style={{ maxWidth:860, display:'flex', flexDirection:'column', gap:16 }}>
            {/* Audio recorder */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:4 }}>🎙️ Dictée vocale</div>
              <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:14 }}>Enregistrez la consultation — l'IA remplit les champs automatiquement</div>
              {!audioBlob ? (
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {!recording ? (
                    <button onClick={startRec} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:99, border:'none', background:'#EF4444', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(239,68,68,.35)' }}>
                      <span style={{ width:9, height:9, borderRadius:'50%', background:'white' }} /> Enregistrer
                    </button>
                  ) : (
                    <>
                      <div style={{ display:'flex', gap:3, alignItems:'center', height:28 }}>
                        {Array.from({length:12}).map((_,i) => <div key={i} style={{ width:3, borderRadius:99, background:'#EF4444', height:`${8+Math.sin(i*.6)*8}px`, animation:`wave ${.4+i*.04}s ease-in-out infinite alternate` }} />)}
                        <style>{`@keyframes wave{from{height:6px}to{height:20px}}`}</style>
                      </div>
                      <span style={{ fontSize:20, fontWeight:300, color:'#EF4444', fontVariantNumeric:'tabular-nums' }}>{fmt(recTime)}</span>
                      <button onClick={stopRec} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'var(--gray-900)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>⏹ Terminer</button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--gray-50)', borderRadius:9, padding:'10px 14px' }}>
                    <span style={{ fontSize:18 }}>🎵</span>
                    <audio controls src={URL.createObjectURL(audioBlob)} style={{ flex:1, height:30 }} />
                    <button onClick={() => { setAudioBlob(null); setAiDone(false) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:14 }}>🗑</button>
                  </div>
                  {!aiDone && (
                    <button onClick={transcribeAndFill} disabled={transcribing}
                      style={{ padding:'11px', borderRadius:9, border:'none', background:'linear-gradient(135deg, var(--blue), #7C3AED)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      {transcribing ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Analyse en cours...</> : '✨ Analyser avec l\'IA — Remplir automatiquement'}
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </button>
                  )}
                  {aiDone && <div style={{ padding:'8px 12px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, fontSize:12, color:'#059669', fontWeight:600 }}>✅ Champs remplis par l'IA — vérifiez et complétez si besoin</div>}
                </div>
              )}
            </div>

            {/* Motif */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:12 }}>💬 Motif de consultation</div>
              <textarea className="input" value={motif} onChange={e => setMotif(e.target.value)} rows={3} style={{ resize:'vertical', lineHeight:1.7, background: motif ? '#FAFEFF' : 'white', borderColor: motif ? 'var(--blue-mid)' : 'var(--gray-200)' }} placeholder="Décrivez la demande du patient..." />
            </div>

            {/* Antécédents structurés */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:14 }}>📋 Antécédents médicaux</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { key:'medical', label:'Antécédents médicaux', placeholder:'HTA, diabète, cardiopathie...' },
                  { key:'chirurgical', label:'Antécédents chirurgicaux', placeholder:'Chirurgies précédentes...' },
                  { key:'allergie', label:'⚠️ Allergies', placeholder:'Pénicilline, latex, iode...', important:true },
                  { key:'medicaments', label:'Médicaments en cours', placeholder:'Anticoagulants, aspirine...', important:true },
                  { key:'tabac', label:'Tabac / Alcool', placeholder:'Fumeur, dose...' },
                  { key:'grossesse', label:'Grossesse / Allaitement', placeholder:'Non, oui, date...' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.important ? 'span 1' : 'span 1' }}>
                    <label style={{ fontSize:11, fontWeight:600, color: f.important ? '#DC2626' : 'var(--gray-600)', display:'block', marginBottom:4 }}>{f.label}</label>
                    <textarea className="input" value={(antecedents as any)[f.key]} onChange={e => setAntecedents(a => ({ ...a, [f.key]: e.target.value }))} rows={2} style={{ resize:'none', fontSize:13, lineHeight:1.6, borderColor: f.important && (antecedents as any)[f.key] ? '#FECACA' : 'var(--gray-200)' }} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Champs spécifiques à l'acte */}
            {selectedActe?.fields_specifiques?.length > 0 && (
              <div className="card" style={{ padding:20 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                  🩺 Examen spécifique — {selectedActe.nom}
                  <span style={{ fontSize:11, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'1px 8px', borderRadius:99, fontWeight:500 }}>Spécialisé</span>
                </div>
                <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:14 }}>Champs adaptés à cet acte esthétique</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {(selectedActe.fields_specifiques as any[]).map((field: any) => (
                    <div key={field.key} style={{ gridColumn: field.type === 'textarea' ? 'span 2' : 'span 1' }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:4 }}>{field.label}</label>
                      {field.type === 'select' && (
                        <select className="input" value={acteFields[field.key] ?? ''} onChange={e => setActeFields(f => ({ ...f, [field.key]: e.target.value }))} style={{ fontSize:13 }}>
                          <option value="">—</option>
                          {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {field.type === 'multicheck' && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {field.options?.map((o: string) => {
                            const selected = (acteFields[field.key] ?? []).includes(o)
                            return (
                              <button key={o} type="button" onClick={() => {
                                const current: string[] = acteFields[field.key] ?? []
                                setActeFields(f => ({ ...f, [field.key]: selected ? current.filter(x => x !== o) : [...current, o] }))
                              }} style={{ padding:'4px 10px', borderRadius:6, border:`1.5px solid ${selected ? 'var(--blue)' : 'var(--gray-200)'}`, background: selected ? 'var(--blue-light)' : 'white', color: selected ? 'var(--blue-dark)' : 'var(--gray-600)', fontSize:12, cursor:'pointer', fontWeight: selected ? 600 : 400 }}>
                                {o}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {field.type === 'number' && (
                        <input className="input" type="number" step={field.step ?? '1'} value={acteFields[field.key] ?? ''} onChange={e => setActeFields(f => ({ ...f, [field.key]: e.target.value }))} style={{ fontSize:13 }} />
                      )}
                      {field.type === 'textarea' && (
                        <textarea className="input" value={acteFields[field.key] ?? ''} onChange={e => setActeFields(f => ({ ...f, [field.key]: e.target.value }))} rows={3} style={{ resize:'vertical', fontSize:13, lineHeight:1.6 }} placeholder={field.placeholder ?? ''} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Devis */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:12 }}>💰 Devis</div>
              <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label className="label">Montant estimé (€)</label>
                  <input className="input" type="number" value={devisMontant} onChange={e => setDevis(e.target.value)} placeholder={selectedActe?.prix_base?.toString() ?? '0'} />
                </div>
                <div style={{ fontSize:12, color:'var(--gray-400)', paddingBottom:10 }}>TVA non incluse</div>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ fontSize:13 }}>← Retour</button>
              <button onClick={() => setStep(3)} className="btn-primary" style={{ fontSize:13 }}>Voir le résumé →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Résumé ── */}
        {step === 3 && (
          <div style={{ maxWidth:720, display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card" style={{ padding:24 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--gray-900)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                📋 Récapitulatif de la consultation
                {selectedActe && <span style={{ fontSize:12, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'2px 10px', borderRadius:99, fontWeight:600 }}>{selectedActe.nom}</span>}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Motif', value: motif },
                  { label:'Antécédents médicaux', value: antecedents.medical },
                  { label:'Allergies', value: antecedents.allergie, important: true },
                  { label:'Médicaments', value: antecedents.medicaments, important: true },
                  { label:'Devis', value: devisMontant ? `${devisMontant} €` : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ padding:'10px 14px', borderRadius:9, background: f.important ? '#FEF2F2' : 'var(--gray-50)', border:`1px solid ${f.important ? '#FECACA' : 'var(--gray-100)'}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color: f.important ? '#DC2626' : 'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{f.label}</div>
                    <div style={{ fontSize:13, color:'var(--gray-800)', lineHeight:1.6 }}>{f.value}</div>
                  </div>
                ))}
                {Object.entries(acteFields).filter(([,v]) => v && (!Array.isArray(v) || v.length > 0)).map(([k, v]) => (
                  <div key={k} style={{ padding:'10px 14px', borderRadius:9, background:'var(--blue-light)', border:'1px solid var(--blue-mid)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--blue-dark)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.replace(/_/g,' ')}</div>
                    <div style={{ fontSize:13, color:'var(--blue-dark)' }}>{Array.isArray(v) ? v.join(', ') : v}</div>
                  </div>
                ))}
              </div>

              {selectedActe?.instructions_post && (
                <div style={{ marginTop:14, padding:'12px 14px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, fontSize:12, color:'#166534' }}>
                  <strong>📋 Instructions post-acte à remettre au patient :</strong><br />{selectedActe.instructions_post}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
              <button onClick={() => setStep(2)} className="btn-secondary" style={{ fontSize:13 }}>← Modifier</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize:14, padding:'12px 28px' }}>
                {saving ? 'Enregistrement...' : '✓ Enregistrer la consultation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
