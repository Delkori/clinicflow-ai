'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, STEP_TYPE_LABELS, STEP_TYPE_COLORS } from '@/lib/utils'
import type { Patient, Consultation, Appointment, Document, WorkflowExecution } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PatientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consultations, setConsultations] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [executions, setExecutions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'consultations' | 'documents' | 'automations'>('timeline')
  const [loading, setLoading] = useState(true)

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
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
  if (!patient) return <div className="p-6 text-gray-500">Patient introuvable</div>

  // Build unified timeline
  const timelineItems = [
    ...consultations.map(c => ({ type: 'consultation', date: c.consultation_date, data: c })),
    ...appointments.map(a => ({ type: 'appointment', date: a.appointment_date, data: a })),
    ...executions.filter(e => e.executed_at).map(e => ({ type: 'execution', date: e.executed_at, data: e })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const tabs = [
    { id: 'timeline', label: '📋 Timeline' },
    { id: 'consultations', label: `🩺 Consultations (${consultations.length})` },
    { id: 'documents', label: `📄 Documents (${documents.length})` },
    { id: 'automations', label: `🤖 Automations (${executions.length})` },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/dashboard/patients" className="text-sm text-violet-600 hover:underline mb-4 inline-block">← Retour patients</Link>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              {patient.email && <span>📧 {patient.email}</span>}
              {patient.phone && <span>📱 {patient.phone}</span>}
              {patient.date_of_birth && <span>🎂 {formatDate(patient.date_of_birth)}</span>}
            </div>
            {patient.notes && <p className="text-sm text-gray-500 mt-2 italic">{patient.notes}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`}
              className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors">
              + Consultation
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{consultations.length}</p>
            <p className="text-xs text-gray-500">Consultations</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
            <p className="text-xs text-gray-500">Rendez-vous</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{executions.filter(e => e.status === 'sent').length}</p>
            <p className="text-xs text-gray-500">Actions envoyées</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          {timelineItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucune activité pour ce patient</div>
          ) : timelineItems.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  item.type === 'consultation' ? 'bg-violet-100' :
                  item.type === 'appointment' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {item.type === 'consultation' ? '🩺' : item.type === 'appointment' ? '📅' : '✉️'}
                </div>
                {i < timelineItems.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1 mb-1">
                {item.type === 'consultation' && (
                  <>
                    <p className="text-sm font-medium text-gray-900">Consultation — {item.data.treatment?.name ?? 'Sans traitement'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      item.data.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{item.data.status}</span>
                  </>
                )}
                {item.type === 'appointment' && (
                  <>
                    <p className="text-sm font-medium text-gray-900">RDV {item.data.type} — {item.data.treatment?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      item.data.status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.data.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{item.data.status}</span>
                  </>
                )}
                {item.type === 'execution' && (
                  <>
                    <p className="text-sm font-medium text-gray-900">{STEP_TYPE_LABELS[item.data.step?.type] ?? '📨'} {item.data.step?.template_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(item.date)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
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
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🩺</p>
              <p>Aucune consultation</p>
              <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`}
                className="mt-3 inline-block bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
                Créer une consultation
              </Link>
            </div>
          ) : consultations.map(c => (
            <Link key={c.id} href={`/dashboard/consultations/${c.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{c.treatment?.name ?? 'Sans traitement'}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDateTime(c.consultation_date)}</p>
                  {c.structured_data?.motif_consultation && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.structured_data.motif_consultation}</p>
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
        <div className="space-y-2">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucun document</div>
          ) : documents.map(d => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <span className="text-xl">📄</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{d.name}</p>
                <p className="text-xs text-gray-500">{d.type} — {formatDate(d.created_at)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                d.status === 'signed' ? 'bg-green-100 text-green-700' :
                d.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'automations' && (
        <div className="space-y-2">
          {executions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucune automation</div>
          ) : executions.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${STEP_TYPE_COLORS[e.step?.type] ?? 'bg-gray-100 text-gray-600'}`}>
                {STEP_TYPE_LABELS[e.step?.type] ?? e.step?.type}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{e.step?.template_name}</p>
                <p className="text-xs text-gray-500">{e.scheduled_at ? formatDateTime(e.scheduled_at) : '—'}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                e.status === 'sent' ? 'bg-green-100 text-green-700' :
                e.status === 'failed' ? 'bg-red-100 text-red-700' :
                e.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}>{e.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
