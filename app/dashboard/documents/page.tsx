'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const TYPE_CFG: Record<string, {label:string;icon:string;color:string;bg:string}> = {
  consentement: { label:'Consentement', icon:'✍️', color:'#6B21A8', bg:'#FAF5FF' },
  devis:        { label:'Devis',        icon:'💰', color:'#D97706', bg:'#FFFBEB' },
  rapport:      { label:'Rapport',      icon:'📋', color:'#1D4ED8', bg:'#EFF6FF' },
  pre_op:       { label:'Pré-op',       icon:'📌', color:'#DC2626', bg:'#FEF2F2' },
  post_op:      { label:'Post-op',      icon:'🩹', color:'#059669', bg:'#F0FDF4' },
  ordonnance:   { label:'Ordonnance',   icon:'💊', color:'#0891B2', bg:'#ECFEFF' },
  custom:       { label:'Personnalisé', icon:'📄', color:'#475569', bg:'#F8FAFC' },
}

const STATUS_CFG: Record<string, {label:string;color:string;bg:string}> = {
  draft:     { label:'Brouillon',  color:'#D97706', bg:'#FFFBEB' },
  generated: { label:'Généré',     color:'#1D4ED8', bg:'#EFF6FF' },
  sent:      { label:'Envoyé',     color:'#0891B2', bg:'#ECFEFF' },
  signed:    { label:'✓ Signé',    color:'#059669', bg:'#F0FDF4' },
}

export default function DocumentsPage() {
  const supabase = createClient()
  const [docs, setDocs]           = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'documents'|'templates'>('documents')
  const [filterType, setFilterType] = useState('all')
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedDoc, setSelectedDoc]   = useState<any>(null)
  const [clinicId, setClinicId]         = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data: d }, { data: t }] = await Promise.all([
      supabase.from('generated_documents').select('*, patient:patients(first_name, last_name)').order('created_at', { ascending: false }),
      supabase.from('document_templates').select('*').eq('clinic_id', prof.clinic_id).order('created_at'),
    ])
    setDocs(d ?? [])
    setTemplates(t ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filterType === 'all' ? docs : docs.filter(d => d.type === filterType)

  async function handleSign(doc: any) {
    const res = await fetch('/api/documents/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: doc.id, signer_email: doc.signer_email }),
    })
    const data = await res.json()
    if (data.success) {
      if (data.simulated) {
        alert(`Mode démo — Yousign non configuré.\nURL simulée : ${data.signature_url}`)
      } else {
        window.open(data.signature_url, '_blank')
      }
      await load()
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Documents</div>
          <div className="page-subtitle">Rapports, consentements, devis et signatures électroniques</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/documents/templates" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>
            📝 Templates
          </Link>
          <Link href="/dashboard/documents/sign" className="btn-primary" style={{ textDecoration:'none', fontSize:13, display:'flex', gap:6, alignItems:'center' }}>
            ✍️ Envoyer pour signature
          </Link>
          <button onClick={() => setShowGenerate(true)} className="btn-secondary" style={{ fontSize:13 }}>
            + Générer un document
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 32px', display:'flex', gap:0, marginBottom:0 }}>
        {([['documents', `📄 Documents (${docs.length})`], ['templates', `📝 Templates (${templates.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {tab === 'documents' && (
          <>
            {/* Filters */}
            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              <button onClick={() => setFilterType('all')} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filterType==='all' ? 'var(--blue)' : 'white', color: filterType==='all' ? 'white' : 'var(--gray-600)', border: filterType==='all' ? 'none' : '1px solid var(--gray-200)' }}>Tous ({docs.length})</button>
              {Object.entries(TYPE_CFG).map(([k, v]) => {
                const cnt = docs.filter(d => d.type === k).length
                if (!cnt) return null
                return (
                  <button key={k} onClick={() => setFilterType(k)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filterType===k ? v.color : 'white', color: filterType===k ? 'white' : v.color, border: filterType===k ? 'none' : `1px solid ${v.bg}` }}>
                    {v.icon} {v.label} ({cnt})
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucun document généré</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Créez votre premier document depuis un template</div>
                <button onClick={() => setShowGenerate(true)} className="btn-primary" style={{ fontSize:13 }}>+ Générer un document</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Document</th><th>Patient</th><th>Type</th><th>Date</th><th>Statut</th><th></th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(doc => {
                      const tc = TYPE_CFG[doc.type] ?? TYPE_CFG.custom
                      const sc = STATUS_CFG[doc.status] ?? STATUS_CFG.draft
                      return (
                        <tr key={doc.id}>
                          <td>
                            <div style={{ fontSize:13.5, fontWeight:500, color:'var(--gray-900)' }}>{doc.name}</div>
                          </td>
                          <td>
                            <div style={{ fontSize:13, color:'var(--gray-700)' }}>{doc.patient?.first_name} {doc.patient?.last_name}</div>
                          </td>
                          <td>
                            <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, padding:'2px 8px', borderRadius:99 }}>{tc.icon} {tc.label}</span>
                          </td>
                          <td style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDate(doc.created_at)}</td>
                          <td>
                            <span style={{ fontSize:11, fontWeight:600, color:sc.color, background:sc.bg, padding:'2px 8px', borderRadius:99 }}>{sc.label}</span>
                          </td>
                          <td>
                            <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                              {doc.html_content && (
                                <button onClick={() => setSelectedDoc(doc)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-700)' }}>
                                  👁 Aperçu
                                </button>
                              )}
                              {(doc.status === 'generated' || doc.status === 'draft') && (
                                <button onClick={() => handleSign(doc)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'none', background:'#6B21A8', color:'white', cursor:'pointer', fontWeight:600 }}>
                                  ✍️ Faire signer
                                </button>
                              )}
                              {doc.signature_url && doc.status === 'sent' && (
                                <a href={doc.signature_url} target="_blank" style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #DDD6FE', background:'#FAF5FF', color:'#6B21A8', textDecoration:'none', fontWeight:600 }}>
                                  🔗 Lien signature
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'templates' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <Link href="/dashboard/documents/templates/new" className="btn-primary" style={{ textDecoration:'none', fontSize:13 }}>+ Nouveau template</Link>
            </div>
            {templates.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
                <div style={{ fontSize:14, color:'var(--gray-500)' }}>Aucun template. Utilisez l'import par défaut dans Paramètres.</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
                {templates.map(t => {
                  const tc = TYPE_CFG[t.type] ?? TYPE_CFG.custom
                  return (
                    <div key={t.id} className="card" style={{ padding:18 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tc.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:2 }}>{t.name}</div>
                          <span style={{ fontSize:11, color:tc.color, background:tc.bg, padding:'1px 7px', borderRadius:99, fontWeight:600 }}>{tc.label}</span>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <Link href={`/dashboard/documents/templates/${t.id}`} style={{ flex:1, textAlign:'center', fontSize:12, padding:'6px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', color:'var(--gray-700)', textDecoration:'none', fontWeight:500 }}>
                          ✏️ Éditer
                        </Link>
                        <button onClick={() => setShowGenerate(true)} style={{ flex:1, fontSize:12, padding:'6px', borderRadius:7, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontWeight:500 }}>
                          ⚡ Utiliser
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <GenerateModal templates={templates} onClose={() => setShowGenerate(false)} onCreated={() => { setShowGenerate(false); load() }} />
      )}

      {/* Preview modal */}
      {selectedDoc && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:800, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{selectedDoc.name}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => handleSign(selectedDoc)} style={{ fontSize:12, padding:'6px 14px', borderRadius:7, border:'none', background:'#6B21A8', color:'white', cursor:'pointer', fontWeight:600 }}>✍️ Faire signer</button>
                <button onClick={() => setSelectedDoc(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:24 }}>
              <div dangerouslySetInnerHTML={{ __html: selectedDoc.html_content }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GenerateModal({ templates, onClose, onCreated }: any) {
  const supabase = createClient()
  const [patients, setPatients]   = useState<any[]>([])
  const [consults, setConsults]   = useState<any[]>([])
  const [form, setForm]           = useState({ template_id:'', patient_id:'', consultation_id:'' })
  const [loading, setLoading]     = useState(false)
  const [clinicId, setClinicId]   = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user!.id).single()
      if (prof) setClinicId(prof.clinic_id)
      const { data: pts } = await supabase.from('patients').select('id, first_name, last_name').order('last_name')
      setPatients(pts ?? [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!form.patient_id) return
    supabase.from('consultations').select('id, consultation_date, treatment:treatments(name)').eq('patient_id', form.patient_id).order('consultation_date', { ascending: false })
      .then(({ data }) => setConsults(data ?? []))
  }, [form.patient_id])

  const up = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function generate() {
    if (!form.template_id || !form.patient_id) return
    setLoading(true)
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: form.template_id, patient_id: form.patient_id, consultation_id: form.consultation_id || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Générer un document</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">Template *</label>
            <select className="input" value={form.template_id} onChange={up('template_id')}>
              <option value="">Choisir un template...</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Patient *</label>
            <select className="input" value={form.patient_id} onChange={up('patient_id')}>
              <option value="">Choisir un patient...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
            </select>
          </div>
          {consults.length > 0 && (
            <div>
              <label className="label">Consultation associée (optionnel)</label>
              <select className="input" value={form.consultation_id} onChange={up('consultation_id')}>
                <option value="">—</option>
                {consults.map((c: any) => <option key={c.id} value={c.id}>{new Date(c.consultation_date).toLocaleDateString('fr-FR')} — {c.treatment?.name ?? 'Sans traitement'}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={generate} disabled={loading || !form.template_id || !form.patient_id} className="btn-primary">
            {loading ? 'Génération...' : '⚡ Générer'}
          </button>
        </div>
      </div>
    </div>
  )
}
