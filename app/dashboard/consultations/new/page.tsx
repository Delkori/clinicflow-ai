'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'done'

function NewConsultationInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const patientIdParam = searchParams.get('patient_id')

  const [profile, setProfile] = useState<any>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [patientId, setPatientId] = useState(patientIdParam ?? '')
  const [treatmentId, setTreatmentId] = useState('')
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [transcription, setTranscription] = useState('')
  const [aiData, setAiData] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiStep, setAiStep] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) return
      setProfile(prof)
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      setClinic(cl)
      const [{ data: pts }, { data: trts }] = await Promise.all([
        supabase.from('patients').select('id,first_name,last_name').eq('clinic_id', prof.clinic_id).order('last_name'),
        supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id),
      ])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
    }
    load()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [supabase])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
        setRecordingState('done')
      }
      mr.start(200)
      setRecordingState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      setError("Microphone non accessible. Autorisez l'accès au microphone dans votre navigateur.")
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordingState('paused')
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume()
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    setRecordingState('recording')
  }

  function resetRecording() {
    setAudioBlob(null); setTranscription(''); setAiData(null)
    setDuration(0); setRecordingState('idle'); setAiStep(null)
  }

  async function transcribeAudio() {
    if (!audioBlob) return
    setRecordingState('processing')
    setError(null)
    try {
      setAiStep('🎙️ Transcription en cours (Whisper)...')
      const fd = new FormData()
      fd.append('audio', audioBlob, 'recording.webm')
      if (clinic?.id) fd.append('clinic_id', clinic.id)
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTranscription(data.transcription || '')

      if (data.transcription) {
        setAiStep('✨ Structuration GPT-4 en cours...')
        const res2 = await fetch('/api/ai/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcription: data.transcription, clinic_id: clinic?.id }),
        })
        const s = await res2.json()
        if (res2.ok && s.data) { setAiData(s.data); setNotes(s.data.notes || '') }
      }
      setAiStep(null)
    } catch (e: any) {
      setError(e.message)
      setAiStep(null)
    }
    setRecordingState('done')
  }

  async function save() {
    if (!patientId || !profile) return
    setSaving(true); setError(null)
    try {
      const { data: consultation, error: err } = await supabase.from('consultations').insert({
        patient_id: patientId,
        clinic_id: profile.clinic_id,
        treatment_id: treatmentId || null,
        transcription: transcription || null,
        notes,
        status: 'completed',
        consultation_date: new Date().toISOString(),
        audio_duration_seconds: duration || null,
        recording_status: audioBlob ? 'done' : 'none',
        ai_summary: aiData?.summary || null,
        ai_treatment_plan: aiData?.plan_traitement || null,
        ai_antecedents: aiData?.antecedents || null,
        ai_examination: aiData?.examen_clinique || null,
        structured_data: aiData || null,
      }).select().single()
      if (err) throw err
      if (treatmentId && consultation) {
        await fetch('/api/workflows/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultation_id: consultation.id, treatment_id: treatmentId, patient_id: patientId, clinic_id: profile.clinic_id }),
        }).catch(() => {})
      }
      router.push(`/dashboard/patients/${patientId}`)
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="text-2xl font-semibold text-gray-900">Nouvelle consultation</h1>
      </div>

      {error && <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Patient + Treatment */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Patient *</label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input w-full">
              <option value="">Sélectionner un patient</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Traitement (déclenchera le workflow)</label>
            <select value={treatmentId} onChange={e => setTreatmentId(e.target.value)} className="input w-full">
              <option value="">— Aucun traitement —</option>
              {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Audio Recorder */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold text-gray-900 mb-1">Enregistrement audio</h2>
        <p className="text-sm text-gray-500 mb-6">L'IA transcrit et structure automatiquement la fiche médicale.</p>
        <div className="flex flex-col items-center gap-5">
          <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center text-3xl border-4 transition-all ${
            recordingState === 'recording' ? 'bg-rose-50 border-rose-400 animate-pulse'
            : recordingState === 'processing' ? 'bg-amber-50 border-amber-400'
            : recordingState === 'done' && audioBlob ? 'bg-green-50 border-green-400'
            : 'bg-gray-50 border-gray-200'
          }`}>
            {recordingState === 'processing' ? '⏳' : recordingState === 'done' && audioBlob ? '✅' : '🎙️'}
            {(recordingState === 'recording' || recordingState === 'paused') &&
              <span className="text-sm font-mono font-semibold mt-1 text-gray-700">{fmt(duration)}</span>}
          </div>

          {aiStep && (
            <div className="flex items-center gap-2 text-sm text-[var(--blue)]">
              <div className="animate-spin w-4 h-4 border-2 border-[var(--blue)] border-t-transparent rounded-full" />
              {aiStep}
            </div>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            {recordingState === 'idle' && (
              <button onClick={startRecording} className="btn-primary">⏺ Démarrer l'enregistrement</button>
            )}
            {recordingState === 'recording' && (
              <>
                <button onClick={pauseRecording} className="btn-secondary">⏸ Pause</button>
                <button onClick={stopRecording} className="btn-primary" style={{ background: '#ef4444' }}>⏹ Terminer</button>
              </>
            )}
            {recordingState === 'paused' && (
              <>
                <button onClick={resumeRecording} className="btn-primary">▶ Reprendre</button>
                <button onClick={stopRecording} className="btn-secondary">⏹ Terminer</button>
              </>
            )}
            {recordingState === 'done' && !transcription && !aiStep && (
              <>
                <button onClick={resetRecording} className="btn-secondary">🔄 Recommencer</button>
                <button onClick={transcribeAudio} className="btn-primary">✨ Transcrire avec l'IA</button>
              </>
            )}
          </div>
          {duration > 0 && recordingState === 'done' && (
            <p className="text-xs text-gray-400">Durée enregistrée : {fmt(duration)}</p>
          )}
        </div>
      </div>

      {/* Transcription */}
      {transcription && (
        <div className="card p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Transcription</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ Whisper</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{transcription}</p>
        </div>
      )}

      {/* AI Structured fiche */}
      {aiData && (
        <div className="card p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Fiche médicale structurée</h2>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">✨ GPT-4</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'motif_consultation', label: 'Motif de consultation' },
              { key: 'antecedents',        label: 'Antécédents' },
              { key: 'examen_clinique',    label: 'Examen clinique' },
              { key: 'recommandations',    label: 'Recommandations' },
              { key: 'plan_traitement',    label: 'Plan de traitement', wide: true },
              { key: 'summary',            label: 'Résumé',            wide: true },
            ].filter(f => aiData[f.key]).map(field => (
              <div key={field.key} className={(field as any).wide ? 'md:col-span-2' : ''}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{field.label}</p>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">{aiData[field.key]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Notes complémentaires</h2>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Notes libres, observations complémentaires..." className="input w-full resize-none" />
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => router.back()} className="btn-secondary">Annuler</button>
        <button onClick={save} disabled={!patientId || saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Enregistrement...' : '✓ Sauvegarder la consultation'}
        </button>
      </div>
    </div>
  )
}

export default function NewConsultationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>}>
      <NewConsultationInner />
    </Suspense>
  )
}
