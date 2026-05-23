'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const FIELD_LABELS: Record<string,{label:string;icon:string}> = {
  motif_consultation: { label:'Motif de consultation', icon:'💬' },
  antecedents:        { label:'Antécédents médicaux',  icon:'📋' },
  medicaments:        { label:'Médicaments',           icon:'💊' },
  allergies:          { label:'Allergies',             icon:'⚠️' },
  diagnostic:         { label:'Diagnostic',            icon:'🔍' },
  zone_donneuse:      { label:'Zone donneuse',         icon:'📍' },
  plan_de_traitement: { label:'Plan de traitement',    icon:'🗺️' },
  mode_de_vie:        { label:'Mode de vie',           icon:'🏃' },
  notes:              { label:'Notes',                 icon:'📝' },
}

export default function ConsultationDetailPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [consultation, setConsultation] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [editData, setEditData] = useState<Record<string,string>>({})
  const [saving, setSaving]     = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [toast, setToast]       = useState<any>(null)

  useEffect(() => {
    supabase.from('consultations').select('*, patient:patients(*), treatment:treatments(*)').eq('id', id as string).single()
      .then(({ data }) => {
        setConsultation(data)
        setEditData(data?.structured_data ?? {})
        setLoading(false)
      })
  }, [id])

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('consultations').update({ structured_data: editData, status: 'completed' }).eq('id', id as string)
    setConsultation((c: any) => ({ ...c, structured_data: editData, status: 'completed' }))
    setEditing(false)
    setSaving(false)
    showToast('Consultation sauvegardée')
  }

  async function handleValidate() {
    await supabase.from('consultations').update({ status: 'validated' }).eq('id', id as string)
    setConsultation((c: any) => ({ ...c, status: 'validated' }))
    showToast('Consultation validée ✓')
  }

  async function sendReportEmail() {
    if (!consultation?.patient?.email) return showToast("Ce patient n'a pas d'email", 'error')
    setEmailSending(true)
    const structured = consultation.structured_data ?? {}
    const body = Object.entries(FIELD_LABELS)
      .filter(([k]) => structured[k])
      .map(([k, {label, icon}]) => `${icon} ${label}\n${structured[k]}`)
      .join('\n\n')

    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: consultation.patient_id,
        subject: `Votre rapport de consultation — {{clinic_name}}`,
        body: `Bonjour {{patient_name}},\n\nSuite à votre consultation du ${formatDateTime(consultation.consultation_date)}, veuillez trouver ci-dessous votre rapport médical.\n\n${body}\n\nCordialement,\n{{clinic_name}}`,
      }),
    })
    const data = await res.json()
    setEmailSending(false)
    if (data.success) showToast(data.simulated ? `Email simulé → ${data.to}` : `Email envoyé à ${data.to}`)
    else showToast(`Erreur: ${data.error}`, 'error')
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!consultation) return <div style={{ padding:32, color:'var(--gray-500)' }}>Consultation introuvable</div>

  const structured = consultation.structured_data ?? {}
  const hasData = Object.values(structured).some(v => !!v)

  const STATUS_CFG: Record<string,{label:string;bg:string;color:string}> = {
    draft:     { label:'Brouillon',  bg:'#FFFBEB', color:'#D97706' },
    completed: { label:'Complétée', bg:'#F0FDF4', color:'#059669' },
    validated: { label:'Validée',   bg:'#EFF6FF', color:'#1D4ED8' },
  }
  const sc = STATUS_CFG[consultation.status] ?? STATUS_CFG.draft

  return (
    <div style={{ position:'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.type==='error' ? '#450A0A' : '#022C22', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500, boxShadow:'0 8px 24px rgba(0,0,0,0.25)', display:'flex', gap:8, alignItems:'center', animation:'slideIn .2s ease' }}>
          {toast.type==='error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}
      <style>{`@keyframes slideIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* Header */}
      <div className="page-header">
        <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:10, display:'flex', gap:6 }}>
          <Link href="/dashboard/consultations" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Consultations</Link>
          <span>›</span>
          <Link href={`/dashboard/patients/${consultation.patient_id}`} style={{ color:'var(--gray-400)', textDecoration:'none' }}>
            {consultation.patient?.first_name} {consultation.patient?.last_name}
          </Link>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div className="avatar" style={{ width:44, height:44, fontSize:15, fontWeight:700 }}>
              {consultation.patient?.first_name?.[0]}{consultation.patient?.last_name?.[0]}
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.2px' }}>
                {consultation.patient?.first_name} {consultation.patient?.last_name}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:3 }}>
                <span style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDateTime(consultation.consultation_date)}</span>
                {consultation.treatment && (
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--gray-600)' }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:consultation.treatment.color }} />
                    {consultation.treatment.name}
                  </span>
                )}
                <span style={{ fontSize:11, fontWeight:600, background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:99 }}>{sc.label}</span>
                {consultation.transcription && <span style={{ fontSize:11, background:'#FAF5FF', color:'#6B21A8', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>🎙️ Transcrit</span>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={sendReportEmail} disabled={emailSending || !consultation.patient?.email} className="btn-secondary" style={{ fontSize:12, display:'flex', gap:6, alignItems:'center' }}>
              {emailSending ? '...' : '📧'} Envoyer le rapport
            </button>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary" style={{ fontSize:12 }}>✏️ Modifier</button>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary" style={{ fontSize:12 }}>Annuler</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize:12 }}>{saving ? 'Sauvegarde...' : '💾 Sauvegarder'}</button>
              </>
            )}
            {consultation.status !== 'validated' && !editing && (
              <button onClick={handleValidate} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#1D4ED8', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ✅ Valider
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-content" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>
        {/* Transcription */}
        {consultation.transcription && (
          <div className="card" style={{ padding:20, gridColumn:'span 2' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
              🎙️ Transcription brute
              <span style={{ fontSize:11, color:'#6B21A8', background:'#FAF5FF', padding:'1px 7px', borderRadius:99, fontWeight:500 }}>OpenAI Whisper</span>
            </div>
            <div style={{ background:'var(--gray-50)', borderRadius:8, padding:'12px 14px', fontSize:13, color:'var(--gray-600)', lineHeight:1.7, maxHeight:120, overflowY:'auto' }}>
              {consultation.transcription}
            </div>
          </div>
        )}

        {/* Structured fields */}
        {!hasData && !editing ? (
          <div className="card" style={{ padding:40, textAlign:'center', gridColumn:'span 2' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:14, color:'var(--gray-500)', marginBottom:16 }}>Aucune donnée structurée — utilisez l'enregistrement audio ou saisissez manuellement</div>
            <button onClick={() => setEditing(true)} className="btn-primary" style={{ fontSize:13 }}>Saisir manuellement</button>
          </div>
        ) : (
          Object.entries(FIELD_LABELS).map(([key, { label, icon }]) => {
            const value = structured[key]
            if (!editing && !value) return null
            return (
              <div key={key} className="card" style={{ padding:16, gridColumn: key==='plan_de_traitement'||key==='notes' ? 'span 2' : 'span 1' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                  {icon} {label}
                  {value && !editing && <span style={{ marginLeft:'auto', fontSize:10, color:'var(--blue)', background:'var(--blue-light)', padding:'1px 6px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>IA</span>}
                </div>
                {editing ? (
                  <textarea value={editData[key] ?? ''} onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                    rows={key==='plan_de_traitement'||key==='notes' ? 4 : 3}
                    className="input" style={{ resize:'vertical', lineHeight:1.6, fontSize:13, background: editData[key] ? '#FAFEFF' : 'white', borderColor: editData[key] ? 'var(--blue-mid)' : 'var(--gray-200)' }} />
                ) : (
                  <div style={{ fontSize:13.5, color:'var(--gray-800)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{value}</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
