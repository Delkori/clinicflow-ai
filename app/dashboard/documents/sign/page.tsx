'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const VARS_INFO = [
  { key:'patient_name',       label:'Nom complet patient',    example:'Marie Dupont' },
  { key:'first_name',         label:'Prénom',                 example:'Marie' },
  { key:'last_name',          label:'Nom de famille',         example:'Dupont' },
  { key:'email',              label:'Email patient',          example:'marie@email.fr' },
  { key:'phone',              label:'Téléphone',              example:'06 12 34 56 78' },
  { key:'clinic_name',        label:'Nom de la clinique',     example:'Clinique Paris 8' },
  { key:'doctor_name',        label:'Nom du médecin',         example:'Dr Martin' },
  { key:'today',              label:"Date d'aujourd'hui",     example:'15 juin 2026' },
  { key:'intervention_date',  label:"Date d'intervention",    example:'22 juillet 2026' },
  { key:'treatment_name',     label:'Traitement',             example:'Rhinoplastie' },
  { key:'devis_number',       label:'Numéro devis',           example:'DEV-2026-042' },
]

const STATUS_CFG: Record<string, {label:string;color:string;bg:string;icon:string}> = {
  draft:    { label:'Brouillon',     color:'#475569', bg:'#F8FAFC',  icon:'📝' },
  sent:     { label:'Envoyé',        color:'#0891B2', bg:'#ECFEFF',  icon:'📤' },
  viewed:   { label:'Consulté',      color:'#D97706', bg:'#FFFBEB',  icon:'👁️' },
  signed:   { label:'✓ Signé',       color:'#059669', bg:'#F0FDF4',  icon:'✅' },
  expired:  { label:'Expiré',        color:'#DC2626', bg:'#FEF2F2',  icon:'⏰' },
  refused:  { label:'Refusé',        color:'#DC2626', bg:'#FEF2F2',  icon:'❌' },
}

export default function DocumentSignPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <SignContent />
    </Suspense>
  )
}

function SignContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patient_id')
  const [tab, setTab] = useState<'send'|'history'>('send')
  const [clinicId, setClinicId] = useState('')
  const [patients, setPatients]   = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [requests, setRequests]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  // Send form state
  const [step, setStep]               = useState<1|2|3>(1)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [customVars, setCustomVars]   = useState<Record<string,string>>({})
  const [searchPatient, setSearchPatient] = useState('')
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState<any>(null)
  const [sendEmail, setSendEmail]     = useState(true)
  const [sendWA, setSendWA]           = useState(false)
  const [toast, setToast]             = useState<any>(null)

  // Upload state
  const [uploading, setUploading]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data: pts }, { data: tmpl }, { data: reqs }] = await Promise.all([
      supabase.from('patients').select('id, first_name, last_name, email, phone').order('last_name'),
      supabase.from('document_templates').select('*').eq('clinic_id', prof.clinic_id).order('created_at'),
      supabase.from('document_sign_requests').select('*, patient:patients(first_name, last_name, email)').eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false }),
    ])
    setPatients(pts ?? [])
    setTemplates(tmpl ?? [])
    setRequests(reqs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Preview
  const preview = selectedTemplate && selectedPatient
    ? interpolatePreview(selectedTemplate.content, {
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        first_name: selectedPatient.first_name,
        last_name: selectedPatient.last_name,
        email: selectedPatient.email ?? '',
        phone: selectedPatient.phone ?? '',
        today: new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }),
        clinic_name: 'Votre Clinique',
        ...customVars,
      })
    : null

  function interpolatePreview(tpl: string, vars: Record<string, string>) {
    return tpl
      .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, c) => vars[k] ? c : '')
      .replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]
        ? `<span style="background:#DBEAFE;color:#1D4ED8;border-radius:3px;padding:1px 4px;font-weight:600">${vars[k]}</span>`
        : `<span style="background:#FEF9C3;color:#92400E;border-radius:3px;padding:1px 4px">{{${k}}}</span>`)
  }

  async function handleUpload(file: File) {
    if (!clinicId) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('clinic_id', clinicId)
    fd.append('name', file.name.replace(/\.[^/.]+$/, ''))
    fd.append('type', 'custom')

    const res = await fetch('/api/documents/upload', { method:'POST', body: fd })
    const data = await res.json()
    if (data.success) {
      showToast(`✓ Document importé : ${data.template?.name}`)
      await load()
      setSelectedTemplate(data.template)
      setStep(2)
    } else {
      showToast(`Erreur : ${data.error}`, false)
    }
    setUploading(false)
  }

  async function handleSend() {
    if (!selectedPatient || !selectedTemplate || !clinicId) return
    setSending(true)
    const res = await fetch('/api/documents/sign-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: selectedPatient.id,
        template_id: selectedTemplate.id,
        custom_vars: customVars,
        send_email: sendEmail,
        send_whatsapp: sendWA,
        signer_email: selectedPatient.email,
        signer_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
      }),
    })
    const data = await res.json()
    setSending(false)
    if (data.success) {
      setSent(data)
      await load()
    } else {
      showToast(`Erreur : ${data.error}`, false)
    }
  }

  const filteredPatients = patients.filter(p =>
    !searchPatient ||
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchPatient.toLowerCase())
  )

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500, boxShadow:'0 8px 24px rgba(0,0,0,.2)' }}>{toast.msg}</div>}

      {/* Header */}
      <div className="page-header" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
            <Link href="/dashboard/documents" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Documents</Link> › Envoyer pour signature
          </div>
          <div className="page-title">Envoi & Signature électronique</div>
          <div className="page-subtitle">Générez, personnalisez et envoyez des documents à signer</div>
        </div>
        {tab === 'send' && !sent && (
          <div style={{ display:'flex', gap:8 }}>
            <input ref={fileRef} type="file" accept=".pdf,.html,.htm" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary" style={{ fontSize:13, display:'flex', gap:6, alignItems:'center' }}>
              {uploading ? 'Import...' : '📎 Importer un document'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 32px', flexShrink:0 }}>
        {([['send','✉️ Envoyer un document'], ['history',`📋 Historique (${requests.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSent(null); setStep(1) }} style={{ padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto' }}>

        {/* ── SEND TAB ── */}
        {tab === 'send' && (
          <div>
            {sent ? (
              // Success state
              <div style={{ maxWidth:560, margin:'40px auto', padding:'0 24px' }}>
                <div className="card" style={{ padding:36, textAlign:'center' }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 16px' }}>✅</div>
                  <h2 style={{ fontSize:20, fontWeight:700, color:'var(--gray-900)', marginBottom:8 }}>Document envoyé !</h2>
                  <p style={{ fontSize:14, color:'var(--gray-500)', lineHeight:1.7, marginBottom:24 }}>
                    Le document a été envoyé à <strong>{selectedPatient?.first_name} {selectedPatient?.last_name}</strong> pour signature électronique.
                    {sent.simulated && <span style={{ display:'block', marginTop:6, fontSize:12, color:'#D97706' }}>⚠️ Mode démo — configurez Yousign pour les vraies signatures</span>}
                  </p>

                  {sent.signature_url && (
                    <div style={{ background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:10, padding:'14px 16px', marginBottom:20, textAlign:'left' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:6 }}>Lien de signature :</div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <code style={{ fontSize:11, color:'var(--blue)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', userSelect:'all' }}>{sent.signature_url}</code>
                        <button onClick={() => { navigator.clipboard.writeText(sent.signature_url); showToast('Lien copié') }}
                          style={{ fontSize:11, padding:'4px 8px', borderRadius:5, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', flexShrink:0 }}>📋</button>
                      </div>
                    </div>
                  )}

                  {selectedPatient?.phone && (
                    <a href={`https://wa.me/${selectedPatient.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Bonjour ${selectedPatient.first_name}, voici le lien pour signer votre document : ${sent.signature_url}`)}`}
                      target="_blank"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px 20px', borderRadius:9, background:'#25D366', color:'white', textDecoration:'none', fontSize:13, fontWeight:700, marginBottom:10 }}>
                      💬 Envoyer le lien par WhatsApp
                    </a>
                  )}

                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { setSent(null); setStep(1); setSelectedPatient(null); setSelectedTemplate(null); setCustomVars({}) }} className="btn-primary" style={{ flex:1, justifyContent:'center', fontSize:13 }}>
                      + Envoyer un autre document
                    </button>
                    <button onClick={() => setTab('history')} className="btn-secondary" style={{ flex:1, justifyContent:'center', fontSize:13 }}>
                      📋 Voir l'historique
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'420px 1fr', height:'100%', minHeight:0 }}>
                {/* Left panel — form */}
                <div style={{ borderRight:'1px solid var(--gray-200)', overflow:'auto', padding:24 }}>
                  {/* Step indicator */}
                  <div style={{ display:'flex', gap:0, marginBottom:24 }}>
                    {['Patient', 'Document', 'Envoi'].map((s, i) => {
                      const sn = (i+1) as 1|2|3
                      const done = step > sn
                      const active = step === sn
                      return (
                        <div key={s} style={{ flex:1, display:'flex', alignItems:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, cursor: done ? 'pointer' : 'default' }} onClick={() => done && setStep(sn)}>
                            <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, background: done ? 'var(--blue)' : active ? 'var(--blue-light)' : 'var(--gray-100)', color: done ? 'white' : active ? 'var(--blue)' : 'var(--gray-400)', border: active ? '2px solid var(--blue)' : done ? 'none' : '2px solid var(--gray-200)', flexShrink:0 }}>
                              {done ? '✓' : sn}
                            </div>
                            <span style={{ fontSize:12, fontWeight: active ? 600 : 400, color: active ? 'var(--gray-900)' : 'var(--gray-400)' }}>{s}</span>
                          </div>
                          {i < 2 && <div style={{ flex:1, height:2, background: done ? 'var(--blue)' : 'var(--gray-200)', margin:'0 6px', borderRadius:1 }} />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Step 1: Patient */}
                  {step === 1 && (
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:14 }}>Sélectionner un patient</div>
                      <input className="input" value={searchPatient} onChange={e => setSearchPatient(e.target.value)} placeholder="Rechercher par nom ou email..." style={{ marginBottom:12 }} />
                      <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:320, overflowY:'auto' }}>
                        {filteredPatients.slice(0, 20).map(p => (
                          <div key={p.id} onClick={() => { setSelectedPatient(p); setStep(2) }}
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, cursor:'pointer', border:`1.5px solid ${selectedPatient?.id===p.id ? 'var(--blue)' : 'var(--gray-100)'}`, background: selectedPatient?.id===p.id ? 'var(--blue-light)' : 'white', transition:'all .1s' }}
                            onMouseEnter={e => { if (selectedPatient?.id!==p.id) e.currentTarget.style.background='var(--gray-50)' }}
                            onMouseLeave={e => { if (selectedPatient?.id!==p.id) e.currentTarget.style.background='white' }}>
                            <div className="avatar" style={{ width:34, height:34, fontSize:12, fontWeight:700, flexShrink:0 }}>{p.first_name[0]}{p.last_name[0]}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13.5, fontWeight:500, color:'var(--gray-900)' }}>{p.first_name} {p.last_name}</div>
                              <div style={{ fontSize:11, color:'var(--gray-500)', display:'flex', gap:8 }}>
                                {p.email && <span>{p.email}</span>}
                                {p.phone && <span>{p.phone}</span>}
                              </div>
                            </div>
                            {selectedPatient?.id===p.id && <span style={{ color:'var(--blue)', fontWeight:700 }}>✓</span>}
                          </div>
                        ))}
                        {filteredPatients.length === 0 && <div style={{ padding:24, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>Aucun patient trouvé</div>}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Template */}
                  {step === 2 && (
                    <div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:14 }}>
                        <button onClick={() => setStep(1)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:13, padding:0 }}>← </button>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Choisir le document</div>
                      </div>

                      {/* Upload zone */}
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
                        onClick={() => fileRef.current?.click()}
                        style={{ border:`2px dashed ${dragOver ? 'var(--blue)' : 'var(--gray-200)'}`, borderRadius:10, padding:'14px', textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--blue-light)' : 'var(--gray-50)', marginBottom:14, transition:'all .15s' }}>
                        <div style={{ fontSize:20, marginBottom:4 }}>{uploading ? '⏳' : '📎'}</div>
                        <div style={{ fontSize:12, color:'var(--gray-500)' }}>{uploading ? 'Importation...' : 'Glissez un PDF ou HTML, ou cliquez'}</div>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:300, overflowY:'auto' }}>
                        {templates.map(t => (
                          <div key={t.id} onClick={() => { setSelectedTemplate(t); setStep(3) }}
                            style={{ padding:'12px 14px', borderRadius:9, cursor:'pointer', border:`1.5px solid ${selectedTemplate?.id===t.id ? 'var(--blue)' : 'var(--gray-200)'}`, background: selectedTemplate?.id===t.id ? 'var(--blue-light)' : 'white', transition:'all .1s', display:'flex', gap:10, alignItems:'flex-start' }}>
                            <div style={{ fontSize:18, flexShrink:0 }}>
                              {t.type==='consent'||t.type==='consentement' ? '📋' : t.type==='devis' ? '💰' : t.type==='imported' ? '📎' : '📄'}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)', marginBottom:3 }}>{t.name}</div>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                <span style={{ fontSize:10, fontWeight:600, background: t.type==='consent'||t.type==='consentement' ? '#FAF5FF' : t.type==='devis' ? '#FFFBEB' : 'var(--gray-100)', color: t.type==='consent'||t.type==='consentement' ? '#6B21A8' : t.type==='devis' ? '#D97706' : 'var(--gray-500)', padding:'1px 6px', borderRadius:99 }}>
                                  {t.type==='consent'||t.type==='consentement' ? 'Consentement' : t.type==='devis' ? 'Devis' : t.type}
                                </span>
                                {t.category === 'imported' && <span style={{ fontSize:10, fontWeight:600, background:'#EFF6FF', color:'#1D4ED8', padding:'1px 6px', borderRadius:99 }}>Importé</span>}
                                {selectedTemplate?.id===t.id && <span style={{ fontSize:10, fontWeight:600, background:'var(--blue)', color:'white', padding:'1px 6px', borderRadius:99 }}>✓ Sélectionné</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {templates.length === 0 && (
                          <div style={{ padding:24, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
                            Aucun template. Importez un document ou créez un template.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Custom vars + send */}
                  {step === 3 && selectedTemplate && selectedPatient && (
                    <div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:16 }}>
                        <button onClick={() => setStep(2)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', fontSize:13, padding:0 }}>← </button>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Personnaliser & envoyer</div>
                      </div>

                      {/* Summary */}
                      <div style={{ background:'var(--gray-50)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
                        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                          <div className="avatar" style={{ width:28, height:28, fontSize:10 }}>{selectedPatient.first_name[0]}{selectedPatient.last_name[0]}</div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>{selectedPatient.first_name} {selectedPatient.last_name}</div>
                            <div style={{ fontSize:11, color:'var(--gray-500)' }}>{selectedPatient.email ?? 'Pas d\'email'}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:'var(--gray-600)' }}>📄 {selectedTemplate.name}</div>
                      </div>

                      {/* Additional custom vars */}
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Variables supplémentaires (optionnel)</div>
                        {[
                          { key:'intervention_date', label:"Date d'intervention", placeholder:'22 juillet 2026' },
                          { key:'treatment_name',    label:'Traitement',           placeholder:'Rhinoplastie' },
                          { key:'doctor_name',       label:'Médecin',              placeholder:'Dr Martin' },
                        ].map(v => (
                          <div key={v.key} style={{ marginBottom:8 }}>
                            <label style={{ fontSize:11, fontWeight:500, color:'var(--gray-500)', display:'block', marginBottom:3 }}>{v.label}</label>
                            <input className="input" style={{ fontSize:12 }} value={customVars[v.key] ?? ''} onChange={e => setCustomVars(cv => ({ ...cv, [v.key]: e.target.value }))} placeholder={v.placeholder} />
                          </div>
                        ))}
                      </div>

                      {/* Send options */}
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Méthode d'envoi</div>
                        <label style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 10px', borderRadius:7, background: sendEmail ? 'var(--blue-light)' : 'var(--gray-50)', border:`1px solid ${sendEmail ? 'var(--blue-mid)' : 'transparent'}`, cursor:'pointer', marginBottom:6 }}>
                          <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ accentColor:'var(--blue)' }} />
                          <div>
                            <div style={{ fontSize:12.5, fontWeight:500, color:'var(--gray-900)' }}>📧 Email</div>
                            <div style={{ fontSize:11, color:'var(--gray-500)' }}>{selectedPatient.email || 'Pas d\'email enregistré'}</div>
                          </div>
                        </label>
                        {selectedPatient.phone && (
                          <label style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 10px', borderRadius:7, background: sendWA ? '#F0FDF4' : 'var(--gray-50)', border:`1px solid ${sendWA ? '#BBF7D0' : 'transparent'}`, cursor:'pointer' }}>
                            <input type="checkbox" checked={sendWA} onChange={e => setSendWA(e.target.checked)} style={{ accentColor:'#25D366' }} />
                            <div>
                              <div style={{ fontSize:12.5, fontWeight:500, color:'var(--gray-900)' }}>💬 WhatsApp</div>
                              <div style={{ fontSize:11, color:'var(--gray-500)' }}>{selectedPatient.phone}</div>
                            </div>
                          </label>
                        )}
                      </div>

                      <button onClick={handleSend} disabled={sending || (!sendEmail && !sendWA)}
                        className="btn-primary" style={{ width:'100%', padding:'13px', fontSize:14, justifyContent:'center', display:'flex', gap:8, alignItems:'center' }}>
                        {sending ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Envoi en cours...</> : '✍️ Envoyer pour signature'}
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right panel — preview */}
                <div style={{ overflow:'auto', background:'var(--gray-50)', display:'flex', flexDirection:'column' }}>
                  <div style={{ padding:'12px 16px', background:'white', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)' }}>Aperçu du document</span>
                    {selectedPatient && selectedTemplate && (
                      <span style={{ fontSize:11, color:'var(--gray-400)' }}>· Les variables en bleu seront remplacées par les vraies données</span>
                    )}
                  </div>
                  {!preview ? (
                    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--gray-400)', padding:32 }}>
                      <div style={{ fontSize:48 }}>📄</div>
                      <div style={{ fontSize:14, fontWeight:500 }}>Aperçu du document</div>
                      <div style={{ fontSize:12, textAlign:'center', maxWidth:280 }}>
                        Sélectionnez un patient et un document pour voir l'aperçu en temps réel
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex:1, padding:24 }}>
                      <div style={{ background:'white', borderRadius:12, border:'1px solid var(--gray-200)', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
                        <div style={{ padding:'8px 14px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-100)', display:'flex', gap:6, alignItems:'center' }}>
                          {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />)}
                          <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:6 }}>{selectedTemplate?.name} — {selectedPatient?.first_name} {selectedPatient?.last_name}</span>
                        </div>
                        <div style={{ padding:24 }} dangerouslySetInnerHTML={{ __html: preview }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="page-content">
            {requests.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✍️</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Aucun document envoyé</div>
                <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Les demandes de signature apparaîtront ici</div>
                <button onClick={() => setTab('send')} className="btn-primary" style={{ fontSize:13 }}>Envoyer un document</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Document</th><th>Patient</th><th>Envoyé le</th><th>Statut</th><th></th></tr></thead>
                  <tbody>
                    {requests.map(r => {
                      const sc = STATUS_CFG[r.status] ?? STATUS_CFG.draft
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontSize:13.5, fontWeight:500, color:'var(--gray-900)', marginBottom:2 }}>{r.name}</div>
                          </td>
                          <td>
                            <div style={{ fontSize:13, color:'var(--gray-700)' }}>{r.patient?.first_name} {r.patient?.last_name}</div>
                            {r.signer_email && <div style={{ fontSize:11, color:'var(--gray-500)' }}>{r.signer_email}</div>}
                          </td>
                          <td style={{ fontSize:12, color:'var(--gray-500)' }}>{r.sent_at ? formatDateTime(r.sent_at) : '—'}</td>
                          <td>
                            <span style={{ fontSize:11, fontWeight:700, color:sc.color, background:sc.bg, padding:'3px 10px', borderRadius:99 }}>
                              {sc.icon} {sc.label}
                            </span>
                            {r.signed_at && <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>le {formatDateTime(r.signed_at)}</div>}
                          </td>
                          <td>
                            <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                              {r.signature_url && r.status !== 'signed' && (
                                <a href={r.signature_url} target="_blank"
                                  style={{ fontSize:11, padding:'4px 9px', borderRadius:6, border:'1px solid var(--blue-mid)', background:'var(--blue-light)', color:'var(--blue)', textDecoration:'none', fontWeight:600 }}>
                                  🔗 Lien
                                </a>
                              )}
                              {r.signature_url && r.patient?.phone && r.status !== 'signed' && (
                                <a href={`https://wa.me/${r.patient.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(`Rappel : veuillez signer votre document en cliquant ici : ${r.signature_url}`)}`}
                                  target="_blank"
                                  style={{ fontSize:11, padding:'4px 9px', borderRadius:6, border:'1px solid #BBF7D0', background:'#F0FDF4', color:'#166534', textDecoration:'none', fontWeight:600 }}>
                                  💬
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
          </div>
        )}
      </div>
    </div>
  )
}
