'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const STRUCTURED_FIELDS = [
  { key: 'motif_consultation',  label: 'Motif de consultation',  icon: '💬', placeholder: 'Raison principale...' },
  { key: 'antecedents',         label: 'Antécédents médicaux',   icon: '📋', placeholder: 'Maladies, chirurgies...' },
  { key: 'medicaments',         label: 'Médicaments',            icon: '💊', placeholder: 'Traitements en cours...' },
  { key: 'allergies',           label: 'Allergies',              icon: '⚠️', placeholder: 'Allergies connues...' },
  { key: 'diagnostic',          label: 'Diagnostic',             icon: '🔍', placeholder: 'Évaluation clinique...' },
  { key: 'zone_donneuse',       label: 'Zone donneuse',          icon: '📍', placeholder: 'Zones identifiées...' },
  { key: 'plan_de_traitement',  label: 'Plan de traitement',     icon: '🗺️', placeholder: 'Protocole recommandé...' },
  { key: 'mode_de_vie',         label: 'Mode de vie',            icon: '🏃', placeholder: 'Habitudes, activité...' },
  { key: 'notes',               label: 'Notes complémentaires',  icon: '📝', placeholder: 'Observations...' },
]

export default function NewConsultationPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:'28px', height:'28px', border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <ConsultationForm />
    </Suspense>
  )
}

function ConsultationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Data
  const [patients, setPatients]     = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [clinicId, setClinicId]     = useState('')
  const [patientId, setPatientId]   = useState(searchParams.get('patient_id') ?? '')
  const [treatmentId, setTreatmentId] = useState('')
  const [structuredData, setStructuredData] = useState<Record<string,string>>({})
  const [transcription, setTranscription]   = useState('')
  const [saving, setSaving]         = useState(false)

  // Audio recording
  const [recordingState, setRecordingState] = useState<'idle'|'recording'|'paused'|'done'>('idle')
  const [recordingTime, setRecordingTime]   = useState(0)
  const [audioBlob, setAudioBlob]           = useState<Blob | null>(null)
  const [audioFile, setAudioFile]           = useState<File | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<NodeJS.Timeout | null>(null)
  const audioRef         = useRef<HTMLAudioElement | null>(null)

  // AI processing
  const [aiStep, setAiStep]     = useState<'idle'|'transcribing'|'structuring'|'done'>('idle')
  const [aiLoading, setAiLoading] = useState(false)

  // File upload fallback
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!profile) return
      setClinicId(profile.clinic_id)
      const [{ data: pts }, { data: trts }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name, email').order('last_name'),
        supabase.from('treatments').select('*').eq('clinic_id', profile.clinic_id),
      ])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
    }
    load()
  }, [])

  // ── Recording functions ──────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        const file = new File([blob], `consultation_${Date.now()}.webm`, { type: mimeType })
        setAudioFile(file)
        stream.getTracks().forEach(t => t.stop())
      }

      mr.start(1000)
      setRecordingState('recording')
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      alert("Impossible d'accéder au microphone. Vérifiez les permissions de votre navigateur.")
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setRecordingState('done')
  }

  function resetRecording() {
    setRecordingState('idle')
    setAudioBlob(null)
    setAudioFile(null)
    setRecordingTime(0)
    setTranscription('')
    setAiStep('idle')
    chunksRef.current = []
  }

  // ── AI processing ────────────────────────────────────────────
  async function processWithAI() {
    const audio = audioFile
    if (!audio) return
    setAiLoading(true)
    setAiStep('transcribing')

    try {
      const fd = new FormData()
      fd.append('audio', audio)
      const transcribeRes = await fetch('/api/ai/transcribe', { method: 'POST', body: fd })
      const { transcription: text, error } = await transcribeRes.json()

      if (error || !text) {
        alert('Erreur de transcription. Vérifiez votre clé OpenAI.')
        setAiLoading(false)
        setAiStep('idle')
        return
      }

      setTranscription(text)
      setAiStep('structuring')

      const treatment = treatments.find(t => t.id === treatmentId)
      const structRes = await fetch('/api/ai/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: text, treatment: treatment?.name }),
      })
      const { structured } = await structRes.json()

      // Merge with existing data
      setStructuredData(prev => ({ ...prev, ...structured }))
      setAiStep('done')
    } catch {
      alert('Erreur lors du traitement IA.')
      setAiStep('idle')
    }
    setAiLoading(false)
  }

  // ── Save ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!patientId || !clinicId) return
    setSaving(true)

    let audioUrl: string | null = null
    if (audioFile) {
      const path = `consultations/${clinicId}/${patientId}/${Date.now()}.webm`
      const { data: up } = await supabase.storage.from('consultations').upload(path, audioFile)
      if (up) {
        const { data: { publicUrl } } = supabase.storage.from('consultations').getPublicUrl(up.path)
        audioUrl = publicUrl
      }
    }

    const { data: consultation, error } = await supabase.from('consultations').insert({
      patient_id: patientId,
      clinic_id: clinicId,
      treatment_id: treatmentId || null,
      transcription: transcription || null,
      structured_data: structuredData,
      audio_url: audioUrl,
      status: Object.keys(structuredData).length > 0 ? 'completed' : 'draft',
    }).select().single()

    if (!error && consultation) {
      // Trigger workflow
      if (treatmentId) {
        await fetch('/api/workflows/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultation_id: consultation.id,
            treatment_id: treatmentId,
            patient_id: patientId,
            clinic_id: clinicId,
          }),
        })
      }
      router.push(`/dashboard/consultations/${consultation.id}`)
    }
    setSaving(false)
  }

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'12px', color:'var(--gray-400)', marginBottom:'6px' }}>
            <Link href="/dashboard/consultations" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Consultations</Link>
            {' '}›{' '}Nouvelle consultation
          </div>
          <div className="page-title">Nouvelle consultation</div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth:'860px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Patient + Treatment */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)', marginBottom:'14px' }}>👤 Informations</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
            <div>
              <label className="label">Patient *</label>
              <select className="input" value={patientId} onChange={e => setPatientId(e.target.value)} required>
                <option value="">Sélectionner un patient...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Traitement</label>
              <select className="input" value={treatmentId} onChange={e => setTreatmentId(e.target.value)}>
                <option value="">Sans traitement</option>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* AUDIO RECORDER */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)', marginBottom:'4px' }}>🎙️ Enregistrement de la consultation</div>
          <div style={{ fontSize:'12px', color:'var(--gray-500)', marginBottom:'16px' }}>Enregistrez la consultation en direct — l'IA transcrit et remplit les champs automatiquement</div>

          {/* Recorder UI */}
          {recordingState === 'idle' && !audioBlob && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <button onClick={startRecording} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 24px', borderRadius:'99px', border:'none', background:'#EF4444', color:'white', fontSize:'14px', fontWeight:'600', cursor:'pointer', boxShadow:'0 4px 14px rgba(239,68,68,0.4)', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform='scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                  <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:'white', display:'inline-block' }} />
                  Démarrer l'enregistrement
                </button>
                <span style={{ color:'var(--gray-400)', fontSize:'13px' }}>ou</span>
                <button onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ fontSize:'13px' }}>
                  📁 Importer un audio
                </button>
                <input ref={fileRef} type="file" accept="audio/*" style={{ display:'none' }}
                  onChange={e => { if (e.target.files?.[0]) setAudioFile(e.target.files[0]) }} />
              </div>
              <div style={{ fontSize:'11px', color:'var(--gray-400)', textAlign:'center' }}>MP3, WAV, M4A, WebM — Formats acceptés pour l'import</div>
            </div>
          )}

          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>
              {/* Waveform animation */}
              <div style={{ display:'flex', gap:'3px', alignItems:'center', height:'40px' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    width:'3px',
                    borderRadius:'99px',
                    background: recordingState === 'recording' ? '#EF4444' : 'var(--gray-300)',
                    height: recordingState === 'recording' ? `${15 + Math.sin(i * 0.8 + Date.now() * 0.001) * 12}px` : '8px',
                    transition:'height 0.15s ease',
                    animation: recordingState === 'recording' ? `wave ${0.5 + i * 0.05}s ease-in-out infinite alternate` : 'none',
                  }} />
                ))}
                <style>{`@keyframes wave{from{height:8px}to{height:32px}}`}</style>
              </div>

              <div style={{ fontSize:'36px', fontWeight:'300', color: recordingState === 'recording' ? '#EF4444' : 'var(--gray-500)', fontVariantNumeric:'tabular-nums', letterSpacing:'2px' }}>
                {formatTime(recordingTime)}
              </div>

              <div style={{ display:'flex', gap:'10px' }}>
                {recordingState === 'recording' ? (
                  <button onClick={pauseRecording} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 20px', borderRadius:'8px', border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:'13px', fontWeight:'500', color:'var(--gray-700)' }}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button onClick={resumeRecording} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 20px', borderRadius:'8px', border:'none', background:'#EF4444', color:'white', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                    ▶ Reprendre
                  </button>
                )}
                <button onClick={stopRecording} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 20px', borderRadius:'8px', border:'none', background:'var(--gray-900)', color:'white', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                  ⏹ Terminer
                </button>
              </div>
            </div>
          )}

          {(recordingState === 'done' || (audioFile && recordingState === 'idle')) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* Audio preview */}
              <div style={{ background:'var(--gray-50)', borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>🎵</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--gray-900)' }}>
                    {audioFile?.name ?? `Enregistrement (${formatTime(recordingTime)})`}
                  </div>
                  {audioBlob && (
                    <audio controls src={URL.createObjectURL(audioBlob)} style={{ width:'100%', height:'32px', marginTop:'4px' }} />
                  )}
                </div>
                <button onClick={resetRecording} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:'13px', padding:'4px', flexShrink:0 }}
                  title="Supprimer l'enregistrement">🗑️</button>
              </div>

              {/* AI Process button */}
              {aiStep === 'idle' && (
                <button onClick={processWithAI} disabled={aiLoading} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', padding:'13px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg, var(--blue) 0%, #7C3AED 100%)', color:'white', fontSize:'14px', fontWeight:'600', cursor:'pointer', boxShadow:'0 4px 14px rgba(5,150,222,0.35)', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                  ✨ Analyser avec l'IA — Transcrire & remplir automatiquement
                </button>
              )}

              {aiLoading && (
                <div style={{ background:'var(--blue-light)', border:'1px solid var(--blue-mid)', borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'20px', height:'20px', border:'3px solid var(--blue-mid)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--blue-dark)' }}>
                      {aiStep === 'transcribing' ? '🎙️ Transcription en cours...' : '🧠 Structuration des données médicales...'}
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--blue)', marginTop:'2px' }}>
                      {aiStep === 'transcribing' ? 'OpenAI Whisper analyse votre enregistrement' : 'GPT-4 identifie les données cliniques'}
                    </div>
                  </div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {aiStep === 'done' && (
                <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'10px', padding:'12px 16px', fontSize:'13px', color:'#059669', display:'flex', alignItems:'center', gap:'8px' }}>
                  <span>✅</span>
                  <span>Transcription et structuration terminées — vérifiez et complétez les champs ci-dessous si nécessaire</span>
                </div>
              )}

              {transcription && (
                <details style={{ fontSize:'12px' }}>
                  <summary style={{ cursor:'pointer', color:'var(--gray-500)', fontWeight:'500', padding:'4px 0' }}>Voir la transcription brute</summary>
                  <div style={{ marginTop:'8px', background:'var(--gray-50)', borderRadius:'8px', padding:'12px', color:'var(--gray-600)', lineHeight:'1.6', maxHeight:'120px', overflowY:'auto' }}>
                    {transcription}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Structured fields */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
            📋 Données médicales structurées
            {aiStep === 'done' && <span style={{ fontSize:'11px', background:'#F0FDF4', color:'#059669', padding:'2px 8px', borderRadius:'99px', fontWeight:'500' }}>✓ Rempli par IA</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {STRUCTURED_FIELDS.map(field => (
              <div key={field.key} style={{ gridColumn: ['plan_de_traitement','notes','transcription_brute'].includes(field.key) ? 'span 2' : 'span 1' }}>
                <label className="label">
                  {field.icon} {field.label}
                  {structuredData[field.key] && <span style={{ marginLeft:'6px', fontSize:'10px', color:'var(--blue)', background:'var(--blue-light)', padding:'1px 5px', borderRadius:'3px' }}>IA</span>}
                </label>
                <textarea
                  value={structuredData[field.key] ?? ''}
                  onChange={e => setStructuredData(d => ({ ...d, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={field.key === 'plan_de_traitement' || field.key === 'notes' ? 3 : 2}
                  className="input"
                  style={{ resize:'vertical', lineHeight:'1.6', fontSize:'13px', background: structuredData[field.key] ? '#FAFEFF' : 'white', borderColor: structuredData[field.key] ? 'var(--blue-mid)' : 'var(--gray-200)' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:'10px', paddingBottom:'24px' }}>
          <Link href="/dashboard/consultations" className="btn-secondary" style={{ textDecoration:'none', fontSize:'14px' }}>
            Annuler
          </Link>
          <button onClick={handleSave} disabled={saving || !patientId} className="btn-primary" style={{ flex:1, justifyContent:'center', fontSize:'14px' }}>
            {saving ? 'Enregistrement...' : treatmentId ? '💾 Enregistrer et démarrer le workflow' : '💾 Enregistrer la consultation'}
          </button>
        </div>
      </div>
    </div>
  )
}
