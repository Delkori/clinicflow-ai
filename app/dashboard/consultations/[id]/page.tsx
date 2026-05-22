'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { ConsultationStructuredData } from '@/lib/types'

const FIELD_LABELS: Record<string, string> = {
  motif_consultation: 'Motif de consultation',
  mode_de_vie: 'Mode de vie',
  diagnostic: 'Diagnostic',
  zone_donneuse: 'Zone donneuse',
  plan_de_traitement: 'Plan de traitement',
  antecedents: 'Antécédents médicaux',
  medicaments: 'Médicaments',
  allergies: 'Allergies',
  notes: 'Notes',
}

export default function ConsultationDetailPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [consultation, setConsultation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<ConsultationStructuredData>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('consultations')
        .select('*, patient:patients(*), treatment:treatments(*)')
        .eq('id', id)
        .single()
      setConsultation(data)
      setEditData(data?.structured_data ?? {})
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    setSaving(true)
    await supabase.from('consultations').update({
      structured_data: editData,
      status: 'completed',
    }).eq('id', id as string)
    setConsultation((c: any) => ({ ...c, structured_data: editData, status: 'completed' }))
    setEditing(false)
    setSaving(false)
  }

  async function handleValidate() {
    await supabase.from('consultations').update({ status: 'validated' }).eq('id', id as string)
    setConsultation((c: any) => ({ ...c, status: 'validated' }))
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
  if (!consultation) return <div className="p-6 text-gray-500">Consultation introuvable</div>

  const structured: ConsultationStructuredData = consultation.structured_data ?? {}

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/consultations" className="text-sm text-violet-600 hover:underline mb-4 inline-block">← Retour</Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Consultation — {consultation.patient?.first_name} {consultation.patient?.last_name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{formatDateTime(consultation.consultation_date)}</p>
            {consultation.treatment && (
              <span className="inline-flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full" style={{ background: consultation.treatment.color }} />
                <span className="text-sm text-gray-600">{consultation.treatment.name}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full ${
              consultation.status === 'validated' ? 'bg-blue-100 text-blue-700' :
              consultation.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-amber-100 text-amber-700'
            }`}>{consultation.status}</span>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                ✏️ Modifier
              </button>
            )}
            {consultation.status !== 'validated' && (
              <button onClick={handleValidate}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                ✅ Valider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transcription */}
      {consultation.transcription && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">🎙️ Transcription</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 max-h-40 overflow-y-auto scrollbar-thin">
            {consultation.transcription}
          </div>
        </div>
      )}

      {/* Structured data */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">📋 Données structurées</h2>
          {editing && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60">
                {saving ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>

        {Object.keys(FIELD_LABELS).filter(k => editing || structured[k as keyof ConsultationStructuredData]).length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">Aucune donnée structurée</p>
            <button onClick={() => setEditing(true)} className="mt-2 text-xs text-violet-600 hover:underline">
              Saisir manuellement
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(FIELD_LABELS).map(([key, label]) => {
              const value = structured[key as keyof ConsultationStructuredData]
              if (!editing && !value) return null
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                  {editing ? (
                    <textarea
                      value={editData[key as keyof ConsultationStructuredData] ?? ''}
                      onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{value}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
