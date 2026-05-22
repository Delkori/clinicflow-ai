'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ConsultationStructuredData } from '@/lib/types'

const STRUCTURED_FIELDS: Array<{ key: keyof ConsultationStructuredData; label: string; placeholder: string }> = [
  { key: 'motif_consultation', label: 'Motif de consultation', placeholder: 'Raison principale de la visite...' },
  { key: 'mode_de_vie', label: 'Mode de vie', placeholder: 'Habitudes, activité physique, tabac...' },
  { key: 'diagnostic', label: 'Diagnostic', placeholder: 'Évaluation clinique...' },
  { key: 'zone_donneuse', label: 'Zone donneuse', placeholder: 'Zones identifiées pour prélèvement (si applicable)...' },
  { key: 'plan_de_traitement', label: 'Plan de traitement', placeholder: 'Protocole recommandé...' },
  { key: 'antecedents', label: 'Antécédents médicaux', placeholder: 'Maladies, opérations, allergies...' },
  { key: 'medicaments', label: 'Médicaments', placeholder: 'Traitements en cours...' },
]

export default function NewConsultationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>}>
      <NewConsultationForm />
    </Suspense>
  )
}

function NewConsultationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [patients, setPatients] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [patientId, setPatientId] = useState(searchParams.get('patient_id') ?? '')
  const [treatmentId, setTreatmentId] = useState('')
  const [structuredData, setStructuredData] = useState<ConsultationStructuredData>({})
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcription, setTranscription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStep, setAiStep] = useState<'idle' | 'transcribing' | 'structuring' | 'done'>('idle')
  const [saving, setSaving] = useState(false)
  const [clinicId, setClinicId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!profile) return
      setClinicId(profile.clinic_id)
      const [{ data: pts }, { data: trts }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').eq('clinic_id', profile.clinic_id).order('last_name'),
        supabase.from('treatments').select('*').eq('clinic_id', profile.clinic_id),
      ])
      setPatients(pts ?? [])
      setTreatments(trts ?? [])
    }
    load()
  }, [])

  async function handleAIProcess() {
    if (!audioFile) return
    setAiLoading(true)
    setAiStep('transcribing')
    try {
      const formData = new FormData()
      formData.append('audio', audioFile)
      const transcribeRes = await fetch('/api/ai/transcribe', { method: 'POST', body: formData })
      const { transcription: text } = await transcribeRes.json()
      setTranscription(text)
      setAiStep('structuring')

      const structureRes = await fetch('/api/ai/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: text, treatment: treatments.find(t => t.id === treatmentId)?.name }),
      })
      const { structured } = await structureRes.json()
      setStructuredData(structured)
      setAiStep('done')
    } catch (err) {
      console.error(err)
    }
    setAiLoading(false)
  }

  async function handleSave() {
    if (!patientId || !clinicId) return
    setSaving(true)

    // Upload audio if present
    let audioUrl: string | null = null
    if (audioFile) {
      const path = `consultations/${clinicId}/${patientId}/${Date.now()}_${audioFile.name}`
      const { data: uploadData } = await supabase.storage.from('consultations').upload(path, audioFile)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('consultations').getPublicUrl(uploadData.path)
        audioUrl = urlData.publicUrl
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
      // Trigger workflow if treatment selected
      if (treatmentId) {
        await fetch('/api/workflows/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultation_id: consultation.id, treatment_id: treatmentId, patient_id: patientId, clinic_id: clinicId }),
        })
      }
      router.push(`/dashboard/consultations/${consultation.id}`)
    }
    setSaving(false)
  }

  const updateField = (key: keyof ConsultationStructuredData) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setStructuredData(d => ({ ...d, [key]: e.target.value }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/consultations" className="text-sm text-violet-600 hover:underline mb-4 inline-block">← Retour</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nouvelle consultation</h1>

      <div className="space-y-6">
        {/* Patient & Treatment selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">👤 Informations</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Patient *</label>
              <select value={patientId} onChange={e => setPatientId(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Sélectionner un patient...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Traitement</label>
              <select value={treatmentId} onChange={e => setTreatmentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Sélectionner un traitement...</option>
                {treatments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* AI Audio transcription */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">🎙️ Transcription IA</h2>
          <p className="text-xs text-gray-500 mb-4">Uploadez un enregistrement audio pour transcrire et structurer automatiquement la consultation</p>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-violet-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden"
              onChange={e => { if (e.target.files?.[0]) setAudioFile(e.target.files[0]) }} />
            {audioFile ? (
              <div>
                <p className="text-2xl mb-1">🎵</p>
                <p className="text-sm font-medium text-gray-700">{audioFile.name}</p>
                <p className="text-xs text-gray-500">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">🎙️</p>
                <p className="text-sm text-gray-600">Cliquez pour uploader un fichier audio</p>
                <p className="text-xs text-gray-400 mt-1">MP3, WAV, M4A, OGG...</p>
              </div>
            )}
          </div>

          {audioFile && (
            <button onClick={handleAIProcess} disabled={aiLoading}
              className="mt-3 w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2">
              {aiLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  {aiStep === 'transcribing' ? 'Transcription en cours...' : 'Structuration IA...'}
                </>
              ) : (
                <>✨ Lancer l&apos;analyse IA</>
              )}
            </button>
          )}

          {aiStep === 'done' && (
            <div className="mt-3 bg-green-50 text-green-700 text-xs p-3 rounded-lg border border-green-200">
              ✅ Transcription et structuration terminées — vérifiez et complétez les champs ci-dessous
            </div>
          )}

          {transcription && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Transcription brute</label>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 max-h-32 overflow-y-auto scrollbar-thin">
                {transcription}
              </div>
            </div>
          )}
        </div>

        {/* Structured fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📋 Données structurées</h2>
          <div className="space-y-4">
            {STRUCTURED_FIELDS.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                <textarea
                  value={structuredData[field.key] ?? ''}
                  onChange={updateField(field.key)}
                  placeholder={field.placeholder}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Link href="/dashboard/consultations"
            className="flex-1 text-center px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button onClick={handleSave} disabled={saving || !patientId}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium py-2.5 transition-colors">
            {saving ? 'Enregistrement...' : treatmentId ? '💾 Enregistrer & déclencher workflow' : '💾 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
