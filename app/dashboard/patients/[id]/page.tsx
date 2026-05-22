'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const STAGES: Record<string, { label: string; icon: string; color: string }> = {
  lead:         { label: 'Lead',         icon: '◎',  color: '#64748B' },
  consultation: { label: 'Consultation', icon: '✦',  color: '#2563EB' },
  devis_envoye: { label: 'Devis envoyé', icon: '📄', color: '#D97706' },
  devis_accepte:{ label: 'Devis accepté',icon: '✅', color: '#059669' },
  pre_op:       { label: 'Pré-op',       icon: '📋', color: '#7C3AED' },
  intervention: { label: 'Intervention', icon: '🔬', color: '#DC2626' },
  post_op_j1:   { label: 'Post-op J+1',  icon: '🩹', color: '#EA580C' },
  post_op_j7:   { label: 'Post-op J+7',  icon: '👁️', color: '#0891B2' },
  post_op_j30:  { label: 'Post-op J+30', icon: '📅', color: '#0596DE' },
  termine:      { label: 'Terminé',      icon: '🏁', color: '#059669' },
}

const STAGE_ORDER = ['lead','consultation','devis_envoye','devis_accepte','pre_op','intervention','post_op_j1','post_op_j7','post_op_j30','termine']

const TYPE_CFG: Record<string, { icon: string; bg: string; color: string }> = {
  email:    { icon: '📧', bg: '#EFF6FF', color: '#1D4ED8' },
  whatsapp: { icon: '💬', bg: '#F0FDF4', color: '#166534' },
  docusign: { icon: '✍️', bg: '#FAF5FF', color: '#6B21A8' },
  document: { icon: '📄', bg: '#F8FAFC', color: '#475569' },
  sms:      { icon: '📱', bg: '#FFFBEB', color: '#92400E' },
}

const CAT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  admin:         { label: 'Administratif', color: '#1D4ED8', bg: '#EFF6FF' },
  medical:       { label: 'Médical',       color: '#DC2626', bg: '#FEF2F2' },
  communication: { label: 'Communication', color: '#059669', bg: '#F0FDF4' },
  post_op:       { label: 'Post-op',       color: '#7C3AED', bg: '#FAF5FF' },
  general:       { label: 'Général',       color: '#475569', bg: '#F8FAFC' },
}

function Toast({ toast }: { toast: any }) {
  if (!toast) return null
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999, background: toast.type === 'success' ? '#022C22' : '#450A0A', color: 'white', padding: '12px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'slideIn 0.2s ease' }}>
      {toast.type === 'success' ? '✓' : '✗'} {toast.msg}
      <style>{`@keyframes slideIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )
}

export default function PatientPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [patient, setPatient] = useState<any>(null)
  const [journeys, setJourneys] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [executions, setExecutions] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [tab, setTab] = useState<'journey' | 'automations' | 'notes' | 'history'>('journey')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [waModal, setWaModal] = useState<any>(null)
  const [noteInput, setNoteInput] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [clinicId, setClinicId] = useState('')

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user!.id).single()
    if (profile) setClinicId(profile.clinic_id)

    const [{ data: p }, { data: j }, { data: c }, { data: e }, { data: n }, { data: al }, { data: a }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('patient_journeys').select('*, treatment:treatments(name,color), checklist:journey_checklist_items(*), journey_docs:journey_documents(*)').eq('patient_id', id).order('created_at', { ascending: false }),
      supabase.from('consultations').select('*, treatment:treatments(name,color)').eq('patient_id', id).order('consultation_date', { ascending: false }),
      supabase.from('workflow_executions').select('*, step:workflow_steps(*), workflow:workflows(name, treatment:treatments(name,color))').eq('patient_id', id).order('scheduled_at', { ascending: true }),
      supabase.from('patient_notes').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
      supabase.from('patient_alerts').select('*').eq('patient_id', id).eq('is_resolved', false).order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, treatment:treatments(name,color)').eq('patient_id', id).order('appointment_date', { ascending: false }).limit(5),
    ])
    setPatient(p)
    setJourneys((j ?? []).map((jrn: any) => ({ ...jrn, checklist: (jrn.checklist ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order) })))
    setConsultations(c ?? [])
    setExecutions(e ?? [])
    setNotes(n ?? [])
    setAlerts(al ?? [])
    setAppointments(a ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function toggleChecklist(itemId: string, current: boolean) {
    await supabase.from('journey_checklist_items').update({ is_done: !current, done_at: !current ? new Date().toISOString() : null }).eq('id', itemId)
    setJourneys(prev => prev.map(j => ({ ...j, checklist: j.checklist.map((c: any) => c.id === itemId ? { ...c, is_done: !current } : c) })))
  }

  async function updateDocStatus(docId: string, status: string) {
    await supabase.from('journey_documents').update({ status, sent_at: status === 'sent' ? new Date().toISOString() : undefined, signed_at: status === 'signed' ? new Date().toISOString() : undefined }).eq('id', docId)
    setJourneys(prev => prev.map(j => ({ ...j, journey_docs: j.journey_docs?.map((d: any) => d.id === docId ? { ...d, status } : d) })))
  }

  async function updateStage(journeyId: string, stage: string) {
    const scoreMap: Record<string, number> = { lead: 5, consultation: 20, devis_envoye: 35, devis_accepte: 50, pre_op: 65, intervention: 75, post_op_j1: 82, post_op_j7: 90, post_op_j30: 96, termine: 100 }
    await supabase.from('patient_journeys').update({ stage, score: scoreMap[stage] ?? 0 }).eq('id', journeyId)
    setJourneys(prev => prev.map(j => j.id === journeyId ? { ...j, stage, score: scoreMap[stage] ?? 0 } : j))
    showToast(`Étape mise à jour : ${STAGES[stage]?.label}`)
  }

  async function sendWhatsApp(execution: any, message: string) {
    if (!patient?.phone) return showToast('Numéro de téléphone manquant', 'error')
    setSendingId(execution.id)
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_id: execution.id, patient_id: patient.id, message: message.replace(/\{\{patient_name\}\}/g, `${patient.first_name} ${patient.last_name}`).replace(/\{\{first_name\}\}/g, patient.first_name), phone: patient.phone }),
    })
    const data = await res.json()
    if (data.success) {
      setExecutions(prev => prev.map(e => e.id === execution.id ? { ...e, status: 'sent', executed_at: new Date().toISOString() } : e))
      showToast(data.simulated ? `✓ Mode démo — Twilio non configuré (${data.phone})` : `✓ WhatsApp envoyé à ${data.phone}`)
    } else showToast(`Erreur: ${data.error}`, 'error')
    setSendingId(null)
    setWaModal(null)
  }

  async function addNote() {
    if (!noteInput.trim()) return
    setAddingNote(true)
    const { data } = await supabase.from('patient_notes').insert({ patient_id: id as string, clinic_id: clinicId, content: noteInput, type: 'note' }).select().single()
    if (data) setNotes(prev => [data, ...prev])
    setNoteInput('')
    setAddingNote(false)
  }

  async function startJourney(consultation: any) {
    const res = await fetch('/api/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patient.id, clinic_id: clinicId, treatment_id: consultation.treatment_id, consultation_id: consultation.id, treatment_name: consultation.treatment?.name ?? '' }),
    })
    const { journey } = await res.json()
    if (journey) { await load(); showToast('Parcours patient créé !') }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><div style={{ width: '28px', height: '28px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!patient) return <div style={{ padding: '32px' }}>Patient introuvable</div>

  const totalExec = executions.length
  const sentExec = executions.filter(e => e.status === 'sent').length
  const pendingExec = executions.filter(e => e.status === 'pending').length

  return (
    <div style={{ position: 'relative' }}>
      <Toast toast={toast} />

      {/* HEADER */}
      <div className="page-header" style={{ paddingBottom: '0' }}>
        <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link href="/dashboard/patients" style={{ color: 'var(--gray-400)', textDecoration: 'none' }}>Patients</Link>
          <span>›</span>
          <span>{patient.first_name} {patient.last_name}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '20px', fontWeight: '700', flexShrink: 0 }}>
              {patient.first_name[0]}{patient.last_name[0]}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>{patient.first_name} {patient.last_name}</h1>
                {alerts.length > 0 && <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>⚠️ {alerts.length} alerte{alerts.length > 1 ? 's' : ''}</span>}
                <span className={`badge ${patient.source === 'doctolib' ? 'badge-blue' : 'badge-gray'}`}>{patient.source === 'doctolib' ? '📅 Doctolib' : '✋ Manuel'}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '5px', flexWrap: 'wrap' }}>
                {patient.email && <a href={`mailto:${patient.email}`} style={{ fontSize: '13px', color: 'var(--gray-500)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>📧 {patient.email}</a>}
                {patient.phone && <a href={`https://wa.me/${patient.phone.replace(/\D/g,'')}`} target="_blank" style={{ fontSize: '13px', color: '#059669', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>💬 {patient.phone}</a>}
                {patient.date_of_birth && <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>🎂 {formatDate(patient.date_of_birth)}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {patient.phone && <a href={`https://wa.me/${patient.phone.replace(/\D/g,'')}`} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#25D366', color: 'white', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>💬 WhatsApp</a>}
            <Link href={`/dashboard/patients/${patient.id}/photos`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '13px' }}>📸 Photos</Link>
            <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="btn-primary" style={{ textDecoration: 'none', fontSize: '13px' }}>+ Consultation</Link>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '24px', paddingTop: '14px', borderTop: '1px solid var(--gray-100)', paddingBottom: '0' }}>
          {[
            { v: consultations.length, l: 'Consultations' },
            { v: journeys.length, l: 'Parcours actifs' },
            { v: sentExec, l: 'Messages envoyés', c: '#059669' },
            { v: pendingExec, l: 'En attente', c: pendingExec > 0 ? '#D97706' : undefined },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', paddingBottom: '14px' }}>
              <span style={{ fontSize: '22px', fontWeight: '700', color: s.c ?? 'var(--gray-900)' }}>{s.v}</span>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{s.l}</span>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {alerts.map(a => (
              <span key={a.id} style={{ fontSize: '12px', color: '#B91C1C', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {a.severity === 'critical' ? '🚨' : '⚠️'} {a.message}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginTop: '4px' }}>
          {([
            { id: 'journey', label: '🗺️ Parcours patient' },
            { id: 'automations', label: `⚡ Automatisations (${executions.length})` },
            { id: 'notes', label: `📝 Notes (${notes.length})` },
            { id: 'history', label: '📋 Historique' },,
          ] as const).filter(Boolean).map((t: any) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent', transition: 'all 0.1s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="page-content">

        {/* ========== PARCOURS PATIENT ========== */}
        {tab === 'journey' && (
          <div>
            {/* No journey CTA */}
            {journeys.length === 0 && (
              <div>
                {consultations.filter(c => c.treatment_id).length > 0 ? (
                  <div className="card" style={{ padding: '32px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'var(--gray-900)' }}>Démarrer un parcours patient</div>
                    <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '16px' }}>Choisissez une consultation pour créer le parcours automatisé avec checklist, documents et suivi.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {consultations.filter(c => c.treatment_id).map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid var(--gray-200)', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.treatment?.color ?? 'var(--blue)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--gray-900)' }}>{c.treatment?.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{formatDate(c.consultation_date)}</div>
                          </div>
                          <button onClick={() => startJourney(c)} className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                            Démarrer le parcours →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Aucun parcours actif</div>
                    <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '20px' }}>Créez une consultation avec un traitement pour générer automatiquement le parcours patient.</div>
                    <Link href={`/dashboard/consultations/new?patient_id=${patient.id}`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                      + Créer une consultation
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Journey cards */}
            {journeys.map(j => {
              const checklist = j.checklist ?? []
              const doneCount = checklist.filter((c: any) => c.is_done).length
              const pct = checklist.length > 0 ? Math.round(doneCount / checklist.length * 100) : 0
              const stageIdx = STAGE_ORDER.indexOf(j.stage)
              const docs = j.journey_docs ?? []

              // Group checklist by category
              const byCat: Record<string, any[]> = {}
              checklist.forEach((item: any) => {
                if (!byCat[item.category]) byCat[item.category] = []
                byCat[item.category].push(item)
              })

              return (
                <div key={j.id} className="card" style={{ marginBottom: '20px', overflow: 'hidden' }}>
                  {/* Journey header */}
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--gray-900) 0%, #1E293B 100%)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: j.treatment?.color ?? 'var(--blue)', flexShrink: 0, boxShadow: `0 0 0 3px ${j.treatment?.color ?? 'var(--blue)'}40` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: '600', fontSize: '15px' }}>{j.treatment?.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>Démarré le {formatDate(j.created_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', lineHeight: 1 }}>{pct}%</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>checklist</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '4px', background: 'var(--gray-100)' }}>
                    <div style={{ height: '100%', background: j.treatment?.color ?? 'var(--blue)', width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>

                  {/* Stage stepper */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', overflowX: 'auto' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Étape du parcours</div>
                    <div style={{ display: 'flex', gap: '0', minWidth: 'max-content' }}>
                      {STAGE_ORDER.map((stage, idx) => {
                        const s = STAGES[stage]
                        const isCurrent = j.stage === stage
                        const isDone = idx < stageIdx
                        return (
                          <button key={stage} onClick={() => updateStage(j.id, stage)} title={s.label} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                            padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer',
                            opacity: isDone || isCurrent ? 1 : 0.4,
                            position: 'relative',
                          }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                              background: isCurrent ? s.color : isDone ? '#DCFCE7' : 'var(--gray-100)',
                              border: isCurrent ? `2px solid ${s.color}` : isDone ? '1.5px solid #86EFAC' : '1.5px solid var(--gray-200)',
                              color: isCurrent ? 'white' : isDone ? '#059669' : 'var(--gray-400)',
                              transition: 'all 0.15s',
                            }}>
                              {isDone ? '✓' : s.icon}
                            </div>
                            <span style={{ fontSize: '10px', color: isCurrent ? s.color : 'var(--gray-500)', fontWeight: isCurrent ? '600' : '400', whiteSpace: 'nowrap' }}>{s.label}</span>
                            {idx < STAGE_ORDER.length - 1 && <div style={{ position: 'absolute', right: '-6px', top: '20px', width: '12px', height: '1.5px', background: isDone ? '#86EFAC' : 'var(--gray-200)' }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                    {/* Checklist */}
                    <div style={{ padding: '16px 20px', borderRight: '1px solid var(--gray-100)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>✅ Checklist <span style={{ fontWeight: '400', color: 'var(--gray-500)' }}>({doneCount}/{checklist.length})</span></span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {Object.entries(byCat).map(([cat, items]) => {
                          const cfg = CAT_CFG[cat] ?? CAT_CFG.general
                          return (
                            <div key={cat} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '600', color: cfg.color, background: cfg.bg, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{cfg.label}</div>
                              {items.map((item: any) => (
                                <div key={item.id} onClick={() => toggleChecklist(item.id, item.is_done)} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.1s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${item.is_done ? '#10B981' : 'var(--gray-300)'}`, background: item.is_done ? '#10B981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.1s' }}>
                                    {item.is_done && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                                  </div>
                                  <span style={{ fontSize: '12.5px', color: item.is_done ? 'var(--gray-400)' : 'var(--gray-700)', textDecoration: item.is_done ? 'line-through' : 'none', lineHeight: '1.4' }}>{item.label}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Documents */}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '12px' }}>
                        📄 Documents <span style={{ fontWeight: '400', color: 'var(--gray-500)' }}>({docs.filter((d: any) => d.status === 'signed' || d.status === 'uploaded').length}/{docs.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {docs.map((doc: any) => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--gray-100)' }}>
                            <span style={{ fontSize: '16px', flexShrink: 0 }}>
                              {doc.type === 'consentement' ? '📋' : doc.type === 'devis' ? '💰' : doc.type === 'photo_before' || doc.type === 'photo_after' ? '📸' : '📄'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.label}</div>
                            </div>
                            <select value={doc.status} onChange={e => updateDocStatus(doc.id, e.target.value)}
                              style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer', color: doc.status === 'signed' || doc.status === 'uploaded' ? '#059669' : doc.status === 'sent' ? '#1D4ED8' : 'var(--gray-500)' }}>
                              <option value="pending">En attente</option>
                              <option value="sent">Envoyé</option>
                              <option value="signed">Signé ✓</option>
                              <option value="uploaded">Uploadé ✓</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ========== AUTOMATISATIONS ========== */}
        {tab === 'automations' && (
          <div>
            {executions.length === 0 ? (
              <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
                <div style={{ fontSize: '14px' }}>Aucune automatisation. Créez un parcours pour démarrer.</div>
              </div>
            ) : (
              <div>
                {/* Group by workflow */}
                {(() => {
                  const groups: Record<string, any[]> = {}
                  executions.forEach(e => {
                    const k = e.workflow_id
                    if (!groups[k]) groups[k] = []
                    groups[k].push(e)
                  })
                  return Object.entries(groups).map(([wid, steps]) => {
                    const wf = steps[0]?.workflow
                    const sent = steps.filter(s => s.status === 'sent').length
                    return (
                      <div key={wid} className="card" style={{ marginBottom: '16px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 18px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wf?.treatment?.color ?? 'var(--blue)', flexShrink: 0 }} />
                          <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--gray-900)', flex: 1 }}>{wf?.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{sent}/{steps.length} envoyés</span>
                          <div style={{ width: '80px', height: '4px', background: 'var(--gray-200)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: wf?.treatment?.color ?? 'var(--blue)', width: `${steps.length ? sent / steps.length * 100 : 0}%` }} />
                          </div>
                        </div>
                        {steps.map((step, si) => {
                          const tc = TYPE_CFG[step.step?.type] ?? TYPE_CFG.document
                          const body = step.step?.template_body?.replace(/\{\{patient_name\}\}/g, `${patient.first_name} ${patient.last_name}`)?.replace(/\{\{first_name\}\}/g, patient.first_name)
                          const isSending = sendingId === step.id
                          return (
                            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 18px', borderBottom: si < steps.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                              {/* Icon */}
                              <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0, border: `1px solid ${tc.bg}` }}>
                                {tc.icon}
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--gray-900)' }}>{step.step?.template_name}</span>
                                  <span style={{ fontSize: '11px', background: 'var(--gray-100)', color: 'var(--gray-600)', padding: '2px 7px', borderRadius: '99px' }}>
                                    {step.step?.timing_days === 0 ? 'Jour J' : step.step?.timing_days > 0 ? `J+${step.step.timing_days}` : `J${step.step.timing_days}`}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500', color: step.status === 'sent' ? '#059669' : step.status === 'failed' ? '#DC2626' : '#D97706' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: step.status === 'sent' ? '#10B981' : step.status === 'failed' ? '#EF4444' : '#F59E0B', display: 'inline-block' }} />
                                    {step.status === 'sent' ? 'Envoyé' : step.status === 'failed' ? 'Échoué' : 'En attente'}
                                  </span>
                                </div>
                                {body && <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '5px', lineHeight: '1.5', background: 'var(--gray-50)', padding: '7px 10px', borderRadius: '7px', borderLeft: `2px solid ${tc.bg}` }}>{body}</div>}
                                {step.scheduled_at && <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '5px' }}>Planifié : {formatDateTime(step.scheduled_at)}</div>}
                                {step.executed_at && <div style={{ fontSize: '11px', color: '#059669', marginTop: '3px' }}>✓ Envoyé : {formatDateTime(step.executed_at)}</div>}
                              </div>
                              {/* Action */}
                              {step.step?.type === 'whatsapp' && step.status !== 'sent' && (
                                <button onClick={() => setWaModal({ execution: step, body: body || step.step?.template_body || '' })}
                                  disabled={isSending || !patient.phone}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: patient.phone ? 'pointer' : 'not-allowed', background: patient.phone ? '#25D366' : 'var(--gray-200)', color: patient.phone ? 'white' : 'var(--gray-400)', fontSize: '12px', fontWeight: '600', flexShrink: 0, opacity: isSending ? 0.7 : 1 }}
                                  title={!patient.phone ? 'Ajoutez un numéro de téléphone à ce patient' : ''}>
                                  {isSending ? <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : '💬'}
                                  {isSending ? 'Envoi...' : 'Envoyer'}
                                </button>
                              )}
                              {step.step?.type !== 'whatsapp' && step.status === 'pending' && (
                                <button onClick={async () => {
                                  await supabase.from('workflow_executions').update({ status: 'sent', executed_at: new Date().toISOString() }).eq('id', step.id)
                                  setExecutions(prev => prev.map(e => e.id === step.id ? { ...e, status: 'sent', executed_at: new Date().toISOString() } : e))
                                  showToast('Marqué comme envoyé')
                                }} style={{ padding: '7px 12px', border: '1px solid var(--gray-200)', background: 'white', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--gray-600)', flexShrink: 0 }}>
                                  ✓ Marquer envoyé
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========== NOTES ========== */}
        {tab === 'notes' && (
          <div>
            {/* Add note */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Ajouter une note sur ce patient..." rows={3}
                className="input" style={{ resize: 'none', lineHeight: '1.6', marginBottom: '10px' }}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote() }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>⌘+Entrée pour enregistrer</span>
                <button onClick={addNote} disabled={addingNote || !noteInput.trim()} className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                  {addingNote ? 'Ajout...' : '+ Ajouter'}
                </button>
              </div>
            </div>
            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)', fontSize: '14px' }}>Aucune note pour ce patient</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notes.map(n => (
                  <div key={n.id} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: '13.5px', color: 'var(--gray-800)', lineHeight: '1.6' }}>{n.content}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '8px' }}>{formatDateTime(n.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== HISTORIQUE ========== */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Consultations */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px' }}>Consultations ({consultations.length})</div>
                {consultations.length === 0 ? <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '13px' }}>Aucune</div> :
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {consultations.map(c => (
                      <Link key={c.id} href={`/dashboard/consultations/${c.id}`} style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue-mid)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.treatment?.color ?? 'var(--blue)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-900)' }}>{c.treatment?.name ?? 'Sans traitement'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{formatDate(c.consultation_date)}</div>
                          </div>
                          <span className={`badge ${c.status === 'completed' ? 'badge-green' : c.status === 'validated' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '10px' }}>{c.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                }
              </div>

              {/* Appointments */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px' }}>Rendez-vous récents</div>
                {appointments.length === 0 ? <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '13px' }}>Aucun</div> :
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {appointments.map(a => (
                      <div key={a.id} className="card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{a.type === 'intervention' ? '🔬' : a.type === 'suivi' ? '👁️' : '🩺'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-900)', textTransform: 'capitalize' }}>{a.type}</div>
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{formatDateTime(a.appointment_date)}</div>
                        </div>
                        <span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'confirmed' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '10px' }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Modal */}
      {waModal && (
        <WaModal patient={patient} execution={waModal.execution} defaultMsg={waModal.body} onClose={() => setWaModal(null)} onSend={(m: string) => sendWhatsApp(waModal.execution, m)} sending={sendingId === waModal.execution.id} />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function WaModal({ patient, execution, defaultMsg, onClose, onSend, sending }: any) {
  const [msg, setMsg] = useState(defaultMsg || '')
  const preview = msg.replace(/\{\{patient_name\}\}/g, `${patient.first_name} ${patient.last_name}`).replace(/\{\{first_name\}\}/g, patient.first_name)
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCF8C6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💬</div>
            <div>
              <div className="modal-title">Envoyer WhatsApp</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{patient.first_name} {patient.last_name}{patient.phone ? ` · ${patient.phone}` : ' · ⚠️ Pas de numéro'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!patient.phone && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B91C1C' }}>⚠️ Numéro de téléphone manquant. Ajoutez-en un dans la fiche patient.</div>}
          <div>
            <label className="label">Message</label>
            <textarea className="input" value={msg} onChange={e => setMsg(e.target.value)} rows={5} style={{ resize: 'vertical', lineHeight: '1.6' }} />
            <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>Variables : <code style={{ background: 'var(--gray-100)', padding: '1px 4px', borderRadius: '3px' }}>{`{{patient_name}}`}</code> <code style={{ background: 'var(--gray-100)', padding: '1px 4px', borderRadius: '3px' }}>{`{{first_name}}`}</code></div>
          </div>
          {/* WhatsApp preview */}
          <div style={{ background: '#E5DDD5', borderRadius: '12px', padding: '12px', backgroundImage: 'url("data:image/svg+xml,%3Csvg...")', }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#075E54', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aperçu WhatsApp</div>
            <div style={{ background: 'white', borderRadius: '8px', borderTopLeftRadius: '2px', padding: '10px 14px', display: 'inline-block', maxWidth: '90%', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', fontSize: '13.5px', color: '#111', lineHeight: '1.6' }}>{preview}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={() => onSend(msg)} disabled={sending || !patient.phone || !msg.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: patient.phone && msg.trim() ? '#25D366' : 'var(--gray-300)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: patient.phone ? 'pointer' : 'not-allowed', opacity: sending ? 0.7 : 1 }}>
            {sending ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />Envoi...</> : <>💬 Envoyer via WhatsApp</>}
          </button>
        </div>
      </div>
    </div>
  )
}
