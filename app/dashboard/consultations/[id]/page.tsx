'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const FIELDS = [
  { key:'motif_consultation', label:'Motif de consultation' },
  { key:'mode_de_vie',        label:'Mode de vie' },
  { key:'diagnostic',         label:'Diagnostic' },
  { key:'zone_donneuse',      label:'Zone donneuse' },
  { key:'plan_de_traitement', label:'Plan de traitement' },
  { key:'antecedents',        label:'Antécédents médicaux' },
  { key:'medicaments',        label:'Médicaments' },
  { key:'allergies',          label:'Allergies' },
  { key:'notes',              label:'Notes' },
]

export default function ConsultationDetail() {
  const { id } = useParams()
  const supabase = createClient()
  const [consultation, setConsultation] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    supabase.from('consultations').select('*, patient:patients(*), treatment:treatments(*)').eq('id', id as string).single()
      .then(({ data }) => { setConsultation(data); setEditData(data?.structured_data ?? {}); setLoading(false) })
  }, [id])

  async function save() {
    setSaving(true)
    await supabase.from('consultations').update({ structured_data:editData, status:'completed' }).eq('id', id as string)
    setConsultation((c:any) => ({ ...c, structured_data:editData, status:'completed' }))
    setEditing(false); setSaving(false)
  }

  async function validate() {
    await supabase.from('consultations').update({ status:'validated' }).eq('id', id as string)
    setConsultation((c:any) => ({ ...c, status:'validated' }))
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!consultation) return <div style={{ padding:32, color:'var(--gray-500)' }}>Consultation introuvable</div>

  const structured = consultation.structured_data ?? {}
  const hasData = Object.values(structured).some(Boolean)

  const statusCfg: Record<string,[string,string]> = {
    draft:     ['badge-gray',   'Brouillon'],
    completed: ['badge-green',  'Complétée'],
    validated: ['badge-blue',   'Validée'],
  }
  const [sCls, sLabel] = statusCfg[consultation.status] ?? ['badge-gray', consultation.status]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:14, display:'flex', gap:6 }}>
          <Link href="/dashboard/consultations" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Consultations</Link>
          <span>›</span>
          <span style={{ color:'var(--gray-700)' }}>{consultation.patient?.first_name} {consultation.patient?.last_name}</span>
        </div>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
              <div className="avatar" style={{ width:38, height:38, fontSize:14, fontWeight:700 }}>
                {consultation.patient?.first_name?.[0]}{consultation.patient?.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)' }}>
                  {consultation.patient?.first_name} {consultation.patient?.last_name}
                </div>
                <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>
                  {formatDateTime(consultation.consultation_date)}
                  {consultation.treatment && (
                    <span style={{ marginLeft:10, display:'inline-flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:consultation.treatment.color }}/>
                      {consultation.treatment.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <span className={`badge ${sCls}`}>{sLabel}</span>
            {!editing && (
              <button onClick={() => setEditing(true)} className="btn-secondary" style={{ fontSize:13 }}>✏️ Modifier</button>
            )}
            {consultation.status !== 'validated' && (
              <button onClick={validate} className="btn-primary" style={{ fontSize:13 }}>✅ Valider</button>
            )}
            <Link href={`/dashboard/patients/${consultation.patient_id}`} style={{ fontSize:13, color:'var(--blue)', textDecoration:'none', fontWeight:500 }}>
              Voir patient →
            </Link>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
          {/* Structured data */}
          <div>
            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--gray-50)' }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>📋 Données structurées</span>
                {editing && (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setEditing(false)} className="btn-secondary" style={{ fontSize:12, padding:'5px 12px' }}>Annuler</button>
                    <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize:12, padding:'5px 12px' }}>{saving?'…':'Sauvegarder'}</button>
                  </div>
                )}
              </div>

              {!hasData && !editing ? (
                <div style={{ padding:'48px', textAlign:'center' }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
                  <div style={{ fontSize:14, color:'var(--gray-500)', marginBottom:16 }}>Aucune donnée structurée</div>
                  <button onClick={() => setEditing(true)} className="btn-secondary" style={{ fontSize:13 }}>Saisir manuellement</button>
                </div>
              ) : (
                <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
                  {FIELDS.map(f => {
                    const val = structured[f.key]
                    if (!editing && !val) return null
                    return (
                      <div key={f.key}>
                        <label className="label" style={{ textTransform:'uppercase', letterSpacing:'.04em', fontSize:10 }}>{f.label}</label>
                        {editing ? (
                          <textarea className="input" value={editData[f.key] ?? ''} onChange={e => setEditData((d:any) => ({...d,[f.key]:e.target.value}))} rows={2} style={{ resize:'none' }} />
                        ) : (
                          <div style={{ background:'var(--gray-50)', borderRadius:8, padding:'9px 12px', fontSize:13.5, color:'var(--gray-700)', lineHeight:1.6 }}>{val}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Transcription */}
            {consultation.transcription && (
              <div className="card" style={{ overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--gray-100)', background:'var(--gray-50)' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>🎙️ Transcription</span>
                </div>
                <div style={{ padding:'12px 16px', fontSize:12, color:'var(--gray-600)', lineHeight:1.65, maxHeight:220, overflowY:'auto' }}>
                  {consultation.transcription}
                </div>
              </div>
            )}

            {/* Quick info */}
            <div className="card" style={{ padding:'16px' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Informations</div>
              {[
                { l:'Patient', v: `${consultation.patient?.first_name} ${consultation.patient?.last_name}` },
                { l:'Email',   v: consultation.patient?.email || '—' },
                { l:'Tél.',    v: consultation.patient?.phone || '—' },
                { l:'Statut',  v: sLabel },
              ].map(r => (
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--gray-100)', fontSize:13 }}>
                  <span style={{ color:'var(--gray-500)' }}>{r.l}</span>
                  <span style={{ color:'var(--gray-800)', fontWeight:500 }}>{r.v}</span>
                </div>
              ))}
            </div>

            {consultation.audio_url && (
              <div className="card" style={{ padding:'16px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Audio</div>
                <audio controls src={consultation.audio_url} style={{ width:'100%', borderRadius:8 }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
