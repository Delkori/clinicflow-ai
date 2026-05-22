'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, STEP_TYPE_LABELS, STEP_TYPE_COLORS } from '@/lib/utils'
import type { Patient, Document } from '@/lib/types'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type JourneyHealth = {
  total: number
  sent: number
  pending: number
  failed: number
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consultations, setConsultations] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [executions, setExecutions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'consultations' | 'documents' | 'automations'>('timeline')
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [
        { data: p },
        { data: c },
        { data: a },
        { data: d },
        { data: e },
      ] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase.from('consultations').select('*, treatment:treatments(*)').eq('patient_id', id).order('consultation_date', { ascending: false }),
        supabase.from('appointments').select('*, treatment:treatments(*)').eq('patient_id', id).order('appointment_date', { ascending: false }),
        supabase.from('documents').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
        supabase.from('workflow_executions').select('*, step:workflow_steps(*)').eq('patient_id', id).order('scheduled_at', { ascending: false }),
      ])
      setPatient(p)
      setConsultations(c ?? [])
      setAppointments(a ?? [])
      setDocuments(d ?? [])
      setExecutions(e ?? [])
      setLoading(false)
    }
    load()
  }, [id, supabase])

  const journeyHealth: JourneyHealth = useMemo(() => ({
    total: executions.length,
    sent: executions.filter((e) => e.status === 'sent').length,
    pending: executions.filter((e) => e.status === 'pending').length,
    failed: executions.filter((e) => e.status === 'failed').length,
  }), [executions])

  const nextAction = useMemo(() => {
    return executions
      .filter((e) => e.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  }, [executions])

  async function reloadExecutions() {
    const { data } = await supabase
      .from('workflow_executions')
      .select('*, step:workflow_steps(*)')
      .eq('patient_id', id)
      .order('scheduled_at', { ascending: false })
    setExecutions(data ?? [])
  }

  async function sendWhatsapp(execution: any) {
    if (!patient?.phone) {
      setToast('Aucun numéro de téléphone sur ce patient')
      return
    }

    setSendingId(execution.id)
    setToast(null)

    const vars = {
      first_name: patient.first_name,
      last_name: patient.last_name,
      full_name: `${patient.first_name} ${patient.last_name}`,
    }

    let message = execution.step?.template_body || 'Bonjour {{first_name}}, ceci est un message de votre clinique.'
    message = message.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key as keyof typeof vars] ?? `{{${key}}}`)

    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        execution_id: execution.id,
        patient_id: patient.id,
        phone: patient.phone,
        message,
      }),
    })

    const result = await response.json()
    setSendingId(null)

    if (!response.ok) {
      setToast(result.error || 'Erreur lors de l’envoi WhatsApp')
      await reloadExecutions()
      return
    }

    setToast(result.simulated ? 'WhatsApp simulé avec succès' : 'WhatsApp envoyé avec succès')
    await reloadExecutions()
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
  if (!patient) return <div className="p-6 text-gray-500">Patient introuvable</div>

  const timelineItems = [
    ...consultations.map(c => ({ type: 'consultation', date: c.consultation_date, data: c })),
    ...appointments.map(a => ({ type: 'appointment', date: a.appointment_date, data: a })),
    ...executions.filter(e => e.executed_at).map(e => ({ type: 'execution', date: e.executed_at, data: e })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const tabs = [
    { id: 'timeline', label: 'Parcours patient' },
    { id: 'consultations', label: `Consultations (${consultations.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'automations', label: `Automations (${executions.length})` },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/patients" className="text-sm text-[var(--blue)] hover:underline mb-4 inline-block">← Retour patients</Link>

      {toast && (
        <div className="mb-4 rounded-xl border border-[var(--blue-mid)] bg-[var(--blue-light)] px-4 py-3 text-sm text-[var(--gray-800)]">
          {toast}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-[var(--blue-light)] text-[var(--blue)] rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0">
              {patient.first_name?.[0]}{patient.last_name?.[0]}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-gray-900">{patient.first_name} {patient.last_name}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                {patient.email && <span>📧 {patient.email}</span>}
                {patient.phone && <span>📱 {patient.phone}</span>}
                {patient.date_of_birth && <span>🎂 {formatDate(patient.date_of_birth)}</span>}
              </div>
              {patient.notes && <p className="text-sm text-gray-500 mt-3 italic">{patient.notes}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="btn-primary">+ Consultation</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{consultations.length}</p>
              <p className="text-xs text-gray-500 mt-1">Consultations</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{appointments.length}</p>
              <p className="text-xs text-gray-500 mt-1">Rendez-vous</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{journeyHealth.sent}</p>
              <p className="text-xs text-gray-500 mt-1">Messages envoyés</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{journeyHealth.pending}</p>
              <p className="text-xs text-gray-500 mt-1">Actions à venir</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Suivi du parcours</p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progression</span>
                <span>{journeyHealth.total === 0 ? 0 : Math.round((journeyHealth.sent / journeyHealth.total) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--blue)] rounded-full" style={{ width: `${journeyHealth.total === 0 ? 0 : (journeyHealth.sent / journeyHealth.total) * 100}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-[var(--green-light)] p-3">
                <p className="text-lg font-semibold text-[var(--green)]">{journeyHealth.sent}</p>
                <p className="text-xs text-gray-600">Envoyé</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-lg font-semibold text-amber-600">{journeyHealth.pending}</p>
                <p className="text-xs text-gray-600">En attente</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-lg font-semibold text-rose-600">{journeyHealth.failed}</p>
                <p className="text-xs text-gray-600">Échec</p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Prochaine action</p>
              {nextAction ? (
                <>
                  <p className="text-sm font-medium text-gray-900">{nextAction.step?.template_name || 'Étape automatique'}</p>
                  <p className="text-xs text-gray-500 mt-1">Prévue le {formatDateTime(nextAction.scheduled_at)}</p>
                  <span className={`inline-flex mt-3 text-xs px-2 py-1 rounded-full ${STEP_TYPE_COLORS[nextAction.step?.type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STEP_TYPE_LABELS[nextAction.step?.type] ?? nextAction.step?.type}
                  </span>
                </>
              ) : (
                <p className="text-sm text-gray-500">Aucune action en attente.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {timelineItems.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">Aucune activité pour ce patient</div>
          ) : timelineItems.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${
                  item.type === 'consultation' ? 'bg-violet-100' : item.type === 'appointment' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {item.type === 'consultation' ? '🩺' : item.type === 'appointment' ? '📅' : '💬'}
                </div>
                {i < timelineItems.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-2" />}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex-1 shadow-sm mb-1">
                {item.type === 'consultation' && (
                  <>
                    <p className="text-sm font-semibold text-gray-900">Consultation — {item.data.treatment?.name ?? 'Sans traitement'}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full mt-3 inline-block ${item.data.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.data.status}</span>
                  </>
                )}
                {item.type === 'appointment' && (
                  <>
                    <p className="text-sm font-semibold text-gray-900">RDV {item.data.type} — {item.data.treatment?.name ?? 'Sans traitement'}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full mt-3 inline-block ${
                      item.data.status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.data.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{item.data.status}</span>
                  </>
                )}
                {item.type === 'execution' && (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{STEP_TYPE_LABELS[item.data.step?.type] ?? '📨'} {item.data.step?.template_name}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full mt-3 inline-block ${
                      item.data.status === 'sent' ? 'bg-green-100 text-green-700' :
                      item.data.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{item.data.status}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'consultations' && (
        <div className="space-y-3">
          {consultations.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🩺</p>
              <p>Aucune consultation</p>
              <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="mt-3 inline-block btn-primary">
                Créer une consultation
              </Link>
            </div>
          ) : consultations.map(c => (
            <Link key={c.id} href={`/dashboard/consultations/${c.id}`} className="block bg-white border border-gray-200 rounded-2xl p-4 hover:border-[var(--blue-mid)] transition-colors shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{c.treatment?.name ?? 'Sans traitement'}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatDateTime(c.consultation_date)}</p>
                  {c.structured_data?.motif_consultation && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-1">{c.structured_data.motif_consultation}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  c.status === 'completed' ? 'bg-green-100 text-green-700' :
                  c.status === 'validated' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>{c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">Aucun document</div>
          ) : documents.map(d => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-xl">📄</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                <p className="text-xs text-gray-500">{d.type} — {formatDate(d.created_at)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                d.status === 'signed' ? 'bg-green-100 text-green-700' :
                d.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'automations' && (
        <div className="space-y-3">
          {executions.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">Aucune automation</div>
          ) : executions.map(e => {
            const canSendWhatsapp = e.status === 'pending' && e.step?.type === 'whatsapp'
            return (
              <div key={e.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${STEP_TYPE_COLORS[e.step?.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STEP_TYPE_LABELS[e.step?.type] ?? e.step?.type}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{e.step?.template_name || 'Étape automatique'}</p>
                      <p className="text-xs text-gray-500 mt-1">Prévu : {e.scheduled_at ? formatDateTime(e.scheduled_at) : '—'}</p>
                      {e.executed_at && <p className="text-xs text-gray-500">Exécuté : {formatDateTime(e.executed_at)}</p>}
                      {e.step?.template_body && (
                        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 whitespace-pre-wrap line-clamp-4">
                          {e.step.template_body}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      e.status === 'sent' ? 'bg-green-100 text-green-700' :
                      e.status === 'failed' ? 'bg-red-100 text-red-700' :
                      e.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>{e.status}</span>
                    {canSendWhatsapp && (
                      <button onClick={() => sendWhatsapp(e)} disabled={sendingId === e.id} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                        {sendingId === e.id ? 'Envoi...' : 'Envoyer WhatsApp'}
                      </button>
                    )}
                  </div>
                </div>
                {e.error_message && (
                  <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
                    {e.error_message}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
