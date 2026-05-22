'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const STAGE_CONFIG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  lead:         { label: 'Lead',          bg: 'bg-gray-100',    color: 'text-gray-600',   emoji: '🌱' },
  consultation: { label: 'Consultation',  bg: 'bg-blue-50',     color: 'text-blue-700',   emoji: '🩺' },
  devis:        { label: 'Devis',         bg: 'bg-amber-50',    color: 'text-amber-700',  emoji: '📋' },
  consent:      { label: 'Consentement',  bg: 'bg-violet-50',   color: 'text-violet-700', emoji: '✍️' },
  rdv:          { label: 'RDV programmé', bg: 'bg-cyan-50',     color: 'text-cyan-700',   emoji: '📅' },
  postop:       { label: 'Post-op',       bg: 'bg-green-50',    color: 'text-green-700',  emoji: '💊' },
}

const EXEC_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sent:    { label: 'Envoyé',     bg: 'bg-green-50',  color: 'text-green-700' },
  pending: { label: 'En attente', bg: 'bg-amber-50',  color: 'text-amber-700' },
  failed:  { label: 'Échoué',     bg: 'bg-red-50',    color: 'text-red-600'   },
}

type Tab = 'consultations' | 'appointments' | 'automations' | 'documents'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [patient, setPatient] = useState<any>(null)
  const [consultations, setConsultations] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [executions, setExecutions] = useState<any[]>([])
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('consultations')
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof?.clinic_id).single()
      setClinic(cl)

      const [{ data: pt }, { data: cons }, { data: appts }, { data: execs }] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase.from('consultations').select('*, treatment:treatments(name,color)').eq('patient_id', id).order('consultation_date', { ascending: false }),
        supabase.from('appointments').select('*, treatment:treatments(name,color)').eq('patient_id', id).order('appointment_date', { ascending: false }),
        supabase.from('workflow_executions').select('*, step:workflow_steps(*)').eq('patient_id', id).order('scheduled_at', { ascending: false }),
      ])
      setPatient(pt)
      setConsultations(cons ?? [])
      setAppointments(appts ?? [])
      setExecutions(execs ?? [])
      setLoading(false)
    }
    load()
  }, [id, supabase])

  async function updateStage(stage: string) {
    await supabase.from('patients').update({ kanban_stage: stage }).eq('id', id)
    setPatient((p: any) => ({ ...p, kanban_stage: stage }))
    showToast(`Étape mise à jour : ${STAGE_CONFIG[stage]?.label}`)
  }

  async function sendWhatsApp(exec: any) {
    if (!patient?.phone) { showToast('❌ Pas de numéro de téléphone'); return }
    setSending(exec.id)
    const vars: Record<string,string> = { first_name: patient.first_name, last_name: patient.last_name }
    const msg = (exec.step?.template_body || 'Bonjour {{first_name}}.').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] ?? '')
    const res = await fetch('/api/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_id: exec.id, patient_id: patient.id, phone: patient.phone, message: msg, clinic_id: clinic?.id }),
    })
    const result = await res.json()
    setSending(null)
    showToast(result.simulated ? '💬 WhatsApp simulé ✓' : '✅ WhatsApp envoyé ✓')
    setExecutions(prev => prev.map(e => e.id === exec.id ? { ...e, status: 'sent' } : e))
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>
  if (!patient) return <div className="p-6 text-gray-500">Patient introuvable.</div>

  const stage = STAGE_CONFIG[patient.kanban_stage ?? 'lead'] ?? STAGE_CONFIG.lead
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtDT = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'consultations', label: '🩺 Consultations', count: consultations.length },
    { id: 'appointments',  label: '📅 Agenda',        count: appointments.length  },
    { id: 'automations',   label: '⚡ Automatisations',count: executions.length   },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white rounded-xl px-5 py-3 text-sm font-medium shadow-xl">{toast}</div>}

      {/* Header card */}
      <div className="card p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">{patient.first_name} {patient.last_name}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${stage.bg} ${stage.color}`}>
                {stage.emoji} {stage.label}
              </span>
            </div>
            <div className="flex gap-4 flex-wrap text-sm text-gray-500 mb-4">
              {patient.phone && <span>📞 {patient.phone}</span>}
              {patient.email && <span>✉️ {patient.email}</span>}
              {patient.date_of_birth && <span>🎂 {fmt(patient.date_of_birth)}</span>}
            </div>
            {/* Stage selector */}
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => updateStage(key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${patient.kanban_stage === key ? `${cfg.bg} ${cfg.color} border-current` : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                  {cfg.emoji} {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="btn-primary text-sm">+ Consultation</Link>
            <button onClick={() => router.back()} className="btn-secondary text-sm">← Retour</button>
          </div>
        </div>
        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-600">{patient.notes}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Consultations', value: consultations.length, icon: '🩺', bg: 'bg-[var(--blue-light)]', color: 'text-[var(--blue)]' },
          { label: 'Rendez-vous',   value: appointments.length,  icon: '📅', bg: 'bg-[var(--green-light)]',color: 'text-[var(--green)]' },
          { label: 'Messages auto', value: executions.filter(e => e.status === 'sent').length, icon: '💬', bg: 'bg-[var(--orange-light)]', color: 'text-[var(--orange)]' },
        ].map(s => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t.id ? 'bg-[var(--blue-light)] text-[var(--blue)]' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'consultations' && (
        <div className="space-y-3">
          {consultations.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🩺</p>
              <p className="text-sm font-medium text-gray-500">Aucune consultation</p>
              <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="btn-primary mt-4 inline-block text-sm">+ Nouvelle consultation</Link>
            </div>
          ) : consultations.map(c => (
            <Link key={c.id} href={`/dashboard/consultations/${c.id}`} className="card p-4 flex items-center gap-4 hover:border-[var(--blue-mid)] transition-colors block">
              <div className="w-10 h-10 rounded-xl bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-lg flex-shrink-0">🩺</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {c.treatment && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: (c.treatment.color||'#2563EB')+'18', color: c.treatment.color||'#2563EB' }}>{c.treatment.name}</span>}
                  {c.ai_summary && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">✨ IA</span>}
                </div>
                <p className="text-sm text-gray-500">{c.consultation_date ? fmtDT(c.consultation_date) : '—'}</p>
                {c.ai_summary && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.ai_summary}</p>}
              </div>
              <span className="text-[var(--blue)] text-sm">→</span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm font-medium text-gray-500">Aucun rendez-vous</p>
            </div>
          ) : appointments.map(a => (
            <div key={a.id} className="card p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-14 text-center py-2 px-2 rounded-xl bg-gray-100 text-gray-700">
                <p className="text-xs font-medium">{new Date(a.appointment_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</p>
                <p className="text-base font-bold leading-tight">{new Date(a.appointment_date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
              </div>
              <div className="flex-1">
                {a.treatment && <span className="text-xs font-medium px-2 py-0.5 rounded-full mb-1 inline-block" style={{ background: (a.treatment.color||'#2563EB')+'18', color: a.treatment.color||'#2563EB' }}>{a.treatment.name}</span>}
                {a.notes && <p className="text-xs text-gray-500">{a.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-3">
          {executions.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">⚡</p>
              <p className="text-sm font-medium text-gray-500">Aucune automatisation</p>
            </div>
          ) : executions.map(e => {
            const st = EXEC_STATUS[e.status] ?? EXEC_STATUS.pending
            const typeLabel: Record<string,string> = { whatsapp: '💬', email: '📧', sms: '📱', wait: '⏳' }
            return (
              <div key={e.id} className="card p-4 flex items-center gap-4">
                <span className="text-2xl flex-shrink-0">{typeLabel[e.step?.type] ?? '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.step?.template_name || e.step?.type || '—'}</p>
                  <p className="text-xs text-gray-400">{e.scheduled_at ? fmtDT(e.scheduled_at) : '—'}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${st.bg} ${st.color}`}>{st.label}</span>
                {e.status === 'pending' && e.step?.type === 'whatsapp' && (
                  <button onClick={() => sendWhatsApp(e)} disabled={sending === e.id}
                    className="btn-primary py-1.5 px-3 text-xs flex-shrink-0 disabled:opacity-50">
                    {sending === e.id ? '...' : '▶ Envoyer'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
