'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  completed:   { label: 'Terminée',  bg: 'bg-green-50',  color: 'text-green-700' },
  in_progress: { label: 'En cours',  bg: 'bg-blue-50',   color: 'text-blue-700'  },
  scheduled:   { label: 'Planifiée', bg: 'bg-amber-50',  color: 'text-amber-700' },
  cancelled:   { label: 'Annulée',   bg: 'bg-red-50',    color: 'text-red-600'   },
}

function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="font-semibold text-gray-900">{title}</p>
        {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

export default function ConsultationDetailPage() {
  const supabase = createClient()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [consultation, setConsultation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('consultations')
      .select('*, patient:patients(*), treatment:treatments(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setConsultation(data)
        setNotes(data?.notes || '')
        setLoading(false)
      })
  }, [id, supabase])

  async function saveNotes() {
    setSaving(true)
    await supabase.from('consultations').update({ notes }).eq('id', id)
    setConsultation((c: any) => ({ ...c, notes }))
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
  if (!consultation) return <div className="p-6 text-gray-500">Consultation introuvable.</div>

  const s = STATUS[consultation.status] ?? STATUS.scheduled
  const d = consultation.structured_data || {}
  const fmt = (date: string) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => router.back()} className="mt-1 text-gray-400 hover:text-gray-700 text-xl flex-shrink-0">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">Consultation</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
            {consultation.ai_summary && <span className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-medium">✨ IA</span>}
          </div>
          <p className="text-sm text-gray-400 mt-1">{consultation.consultation_date ? fmt(consultation.consultation_date) : '—'}</p>
        </div>
        <Link href={`/dashboard/patients/${consultation.patient_id}`} className="btn-secondary text-sm flex-shrink-0">
          Voir le patient →
        </Link>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-5">
        <div className="space-y-5">
          {/* Patient + Treatment */}
          <Section title="Informations">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-lg font-bold flex-shrink-0">
                {consultation.patient?.first_name?.[0]}{consultation.patient?.last_name?.[0]}
              </div>
              <div>
                <Link href={`/dashboard/patients/${consultation.patient_id}`} className="font-semibold text-gray-900 hover:text-[var(--blue)]">
                  {consultation.patient?.first_name} {consultation.patient?.last_name}
                </Link>
                <p className="text-sm text-gray-500">{consultation.patient?.phone || consultation.patient?.email || '—'}</p>
              </div>
              {consultation.treatment && (
                <div className="ml-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: (consultation.treatment.color || '#2563EB') + '18', color: consultation.treatment.color || '#2563EB' }}>
                    {consultation.treatment.name}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* AI Structured data */}
          {(d.motif_consultation || d.antecedents || d.examen_clinique || d.plan_traitement || d.summary) && (
            <Section title="Fiche médicale structurée" badge="✨ GPT-4">
              <div className="space-y-4">
                {[
                  { key: 'motif_consultation', label: 'Motif de consultation' },
                  { key: 'antecedents',        label: 'Antécédents' },
                  { key: 'examen_clinique',    label: 'Examen clinique' },
                  { key: 'plan_traitement',    label: 'Plan de traitement' },
                  { key: 'recommandations',    label: 'Recommandations' },
                  { key: 'summary',            label: 'Résumé' },
                ].filter(f => d[f.key]).map(field => (
                  <div key={field.key}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{field.label}</p>
                    <div className="bg-gray-50 rounded-xl p-3.5 text-sm text-gray-700 leading-relaxed">{d[field.key]}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Transcription */}
          {consultation.transcription && (
            <Section title="Transcription audio" badge="🎙️ Whisper">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                {consultation.transcription}
              </div>
            </Section>
          )}

          {/* Notes */}
          <Section title="Notes">
            {editing ? (
              <div className="space-y-3">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="input w-full resize-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Annuler</button>
                  <button onClick={saveNotes} disabled={saving} className="btn-primary text-sm">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed min-h-[80px]">
                  {notes || <span className="text-gray-400 italic">Aucune note</span>}
                </div>
                <button onClick={() => setEditing(true)} className="absolute top-3 right-3 text-xs text-gray-400 hover:text-[var(--blue)] opacity-0 group-hover:opacity-100 transition-opacity">
                  ✏️ Modifier
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Détails</p>
            {[
              { label: 'Statut',    value: s.label },
              { label: 'Durée',     value: consultation.audio_duration_seconds ? `${Math.floor(consultation.audio_duration_seconds/60)}min` : '—' },
              { label: 'Enreg.',    value: consultation.recording_status === 'done' ? '🎙️ Présent' : '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{row.label}</span>
                <span className="text-xs font-medium text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>

          <Link href={`/dashboard/consultations/new?patient_id=${consultation.patient_id}`} className="btn-secondary w-full text-center text-sm block">
            + Nouvelle consultation
          </Link>
        </div>
      </div>
    </div>
  )
}
