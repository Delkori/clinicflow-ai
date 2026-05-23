'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const VARIABLES = [
  { key: 'patient_name',       label: 'Nom complet patient',      category: 'patient' },
  { key: 'first_name',         label: 'Prénom patient',            category: 'patient' },
  { key: 'last_name',          label: 'Nom patient',               category: 'patient' },
  { key: 'email',              label: 'Email patient',             category: 'patient' },
  { key: 'phone',              label: 'Téléphone patient',         category: 'patient' },
  { key: 'date_of_birth',      label: 'Date de naissance',        category: 'patient' },
  { key: 'clinic_name',        label: 'Nom de la clinique',        category: 'clinique' },
  { key: 'doctor_name',        label: 'Nom du médecin',            category: 'clinique' },
  { key: 'today',              label: "Date d'aujourd'hui",        category: 'dates' },
  { key: 'intervention_date',  label: "Date d'intervention",       category: 'dates' },
  { key: 'devis_number',       label: 'Numéro de devis',          category: 'admin' },
  { key: 'treatment_name',     label: 'Nom du traitement',         category: 'traitement' },
  { key: 'motif_consultation', label: 'Motif de consultation',     category: 'medical' },
  { key: 'diagnostic',         label: 'Diagnostic',               category: 'medical' },
  { key: 'plan_de_traitement', label: 'Plan de traitement',       category: 'medical' },
  { key: 'antecedents',        label: 'Antécédents',              category: 'medical' },
  { key: 'medicaments',        label: 'Médicaments',              category: 'medical' },
]

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  patient:    { color: '#1D4ED8', bg: '#EFF6FF' },
  clinique:   { color: '#059669', bg: '#F0FDF4' },
  dates:      { color: '#D97706', bg: '#FFFBEB' },
  admin:      { color: '#475569', bg: '#F8FAFC' },
  traitement: { color: '#7C3AED', bg: '#FAF5FF' },
  medical:    { color: '#DC2626', bg: '#FEF2F2' },
}

const DEMO_VARS: Record<string, string> = {
  patient_name: 'Sophie Martin',
  first_name: 'Sophie',
  last_name: 'Martin',
  email: 'sophie.martin@email.fr',
  phone: '06 12 34 56 78',
  date_of_birth: '15/03/1985',
  clinic_name: 'Clinique Esthétique Paris',
  doctor_name: 'Martin',
  today: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
  intervention_date: '15 Juillet 2026',
  devis_number: 'DEV-2026-042',
  treatment_name: 'Greffe de cheveux FUE',
  motif_consultation: 'Consultation pour greffe capillaire FUE suite à une alopécie androgénétique stade III.',
  diagnostic: 'Alopécie androgénétique stade III de Hamilton. Zone donneuse dense et de bonne qualité.',
  plan_de_traitement: 'Transplantation FUE de 2500 greffons. Zone frontale et temporale. Durée estimée : 6-8 heures.',
  antecedents: 'Aucun antécédent médical particulier. Pas de chirurgie antérieure.',
  medicaments: 'Minoxidil 5% depuis 2 ans.',
}

export default function TemplateEditorPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const isNew = id === 'new'

  const [template, setTemplate] = useState({
    name: '',
    type: 'consentement' as string,
    category: 'general',
    content: getDefaultContent(),
    is_active: true,
  })
  const [loading, setLoading]   = useState(!isNew)
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(false)
  const [clinicId, setClinicId] = useState('')
  const [activeVarCategory, setActiveVarCategory] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user!.id).single()
      if (prof) setClinicId(prof.clinic_id)

      if (!isNew) {
        const { data } = await supabase.from('document_templates').select('*').eq('id', id as string).single()
        if (data) setTemplate({ name: data.name, type: data.type, category: data.category ?? 'general', content: data.content, is_active: data.is_active })
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function save() {
    setSaving(true)
    if (isNew) {
      const { data } = await supabase.from('document_templates').insert({ ...template, clinic_id: clinicId }).select().single()
      if (data) router.push(`/dashboard/documents/templates/${data.id}`)
    } else {
      await supabase.from('document_templates').update({ ...template, updated_at: new Date().toISOString() }).eq('id', id as string)
    }
    setSaving(false)
  }

  function insertVariable(key: string) {
    const textarea = document.getElementById('template-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = template.content.slice(0, start) + `{{${key}}}` + template.content.slice(end)
    setTemplate(t => ({ ...t, content: newContent }))
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + key.length + 4, start + key.length + 4)
    }, 10)
  }

  const renderedPreview = template.content
    .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, c) => DEMO_VARS[k] ? c : '')
    .replace(/\{\{(\w+)\}\}/g, (_, k) => DEMO_VARS[k] ?? `<span style="background:#FEF9C3;color:#92400E;padding:1px 4px;border-radius:3px">{{${k}}}</span>`)

  const filteredVars = activeVarCategory === 'all' ? VARIABLES : VARIABLES.filter(v => v.category === activeVarCategory)
  const categories = ['all', ...Array.from(new Set(VARIABLES.map(v => v.category)))]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/dashboard/documents" style={{ fontSize:12, color:'var(--gray-400)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
            ← Documents
          </Link>
          <span style={{ color:'var(--gray-300)' }}>/</span>
          <input
            value={template.name}
            onChange={e => setTemplate(t => ({ ...t, name: e.target.value }))}
            placeholder="Nom du template..."
            style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)', border:'none', outline:'none', background:'transparent', minWidth:300 }}
          />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={template.type} onChange={e => setTemplate(t => ({ ...t, type: e.target.value }))}
            style={{ fontSize:12, padding:'6px 10px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', color:'var(--gray-700)', cursor:'pointer' }}>
            <option value="consentement">✍️ Consentement</option>
            <option value="devis">💰 Devis</option>
            <option value="rapport">📋 Rapport</option>
            <option value="pre_op">📌 Pré-op</option>
            <option value="post_op">🩹 Post-op</option>
            <option value="ordonnance">💊 Ordonnance</option>
            <option value="custom">📄 Personnalisé</option>
          </select>
          <button onClick={() => setPreview(!preview)}
            style={{ fontSize:12, padding:'6px 14px', borderRadius:7, border:'1px solid var(--gray-200)', background: preview ? 'var(--blue)' : 'white', color: preview ? 'white' : 'var(--gray-700)', cursor:'pointer', fontWeight:500 }}>
            {preview ? '✏️ Éditer' : '👁 Aperçu'}
          </button>
          <button onClick={save} disabled={saving || !template.name} className="btn-primary" style={{ fontSize:13 }}>
            {saving ? 'Sauvegarde...' : isNew ? '✓ Créer le template' : '✓ Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns: preview ? '1fr' : '1fr 280px', overflow:'hidden' }}>
        {/* Editor / Preview */}
        <div style={{ overflow:'auto', borderRight: preview ? 'none' : '1px solid var(--gray-200)', display:'flex', flexDirection:'column' }}>
          {preview ? (
            <div style={{ padding:40, maxWidth:860, margin:'0 auto', width:'100%' }}>
              <div style={{ background:'white', borderRadius:12, border:'1px solid var(--gray-200)', padding:0, overflow:'hidden' }}>
                <div style={{ padding:'10px 16px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#FF5F57' }} />
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#FEBC2E' }} />
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#28C840' }} />
                  <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:8 }}>Aperçu du document — données de démonstration</span>
                </div>
                <div style={{ padding:32 }} dangerouslySetInnerHTML={{ __html: renderedPreview }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding:'8px 16px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, color:'var(--gray-500)', fontWeight:500 }}>HTML — Utilise les variables ci-contre avec {'{{variable}}'}</span>
                <span style={{ fontSize:11, color:'var(--gray-400)' }}>{template.content.length} caractères</span>
              </div>
              <textarea
                id="template-editor"
                value={template.content}
                onChange={e => setTemplate(t => ({ ...t, content: e.target.value }))}
                style={{ flex:1, padding:20, fontSize:12.5, fontFamily:'Monaco, Consolas, monospace', lineHeight:1.7, border:'none', outline:'none', resize:'none', color:'var(--gray-800)', background:'#FAFAFA' }}
                spellCheck={false}
              />
            </>
          )}
        </div>

        {/* Variables panel */}
        {!preview && (
          <div style={{ overflow:'auto', background:'white', padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Variables disponibles</div>

            {/* Category filter */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveVarCategory(cat)} style={{
                  fontSize:10, padding:'2px 8px', borderRadius:99, border:'none', cursor:'pointer',
                  fontWeight:500, textTransform:'capitalize',
                  background: activeVarCategory === cat ? 'var(--blue)' : 'var(--gray-100)',
                  color: activeVarCategory === cat ? 'white' : 'var(--gray-600)',
                }}>
                  {cat === 'all' ? 'Toutes' : cat}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filteredVars.map(v => {
                const cc = CATEGORY_COLORS[v.category] ?? { color:'var(--gray-600)', bg:'var(--gray-100)' }
                return (
                  <button key={v.key} onClick={() => insertVariable(v.key)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:7, border:'1px solid transparent', background:'var(--gray-50)', cursor:'pointer', textAlign:'left', transition:'all .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background=cc.bg; e.currentTarget.style.borderColor=`${cc.color}30` }}
                    onMouseLeave={e => { e.currentTarget.style.background='var(--gray-50)'; e.currentTarget.style.borderColor='transparent' }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-800)', marginBottom:1 }}>{v.label}</div>
                      <code style={{ fontSize:10, color:cc.color, background:cc.bg, padding:'0 4px', borderRadius:3 }}>{`{{${v.key}}}`}</code>
                    </div>
                    <span style={{ fontSize:14, color:'var(--gray-400)', flexShrink:0 }}>+</span>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop:16, padding:'10px 12px', background:'var(--blue-light)', borderRadius:8, border:'1px solid var(--blue-mid)' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--blue-dark)', marginBottom:4 }}>Condition if/else</div>
              <code style={{ fontSize:10, color:'var(--blue)', lineHeight:1.6, display:'block' }}>
                {'{{#if diagnostic}}'}
                <br/>{'  Contenu si rempli'}
                <br/>{'{{/if}}'}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getDefaultContent() {
  return `<div style="font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a;">
  
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #0596DE;">
    <h1 style="font-size: 20px; font-weight: bold; color: #0F172A; margin: 0;">{{clinic_name}}</h1>
    <h2 style="font-size: 14px; color: #64748B; margin: 8px 0 0; font-weight: normal;">TITRE DU DOCUMENT</h2>
  </div>

  <div style="margin-bottom: 24px;">
    <p><strong>Patient(e) :</strong> {{patient_name}}</p>
    <p><strong>Date :</strong> {{today}}</p>
  </div>

  <h3 style="font-size: 14px; font-weight: bold; margin: 20px 0 8px;">Section 1</h3>
  <p style="line-height: 1.8;">Votre contenu ici...</p>

  {{#if plan_de_traitement}}
  <h3 style="font-size: 14px; font-weight: bold; margin: 20px 0 8px;">Plan de traitement</h3>
  <p style="line-height: 1.8;">{{plan_de_traitement}}</p>
  {{/if}}

  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div>
      <p style="font-size: 13px; color: #64748B;">Signature du patient</p>
      <div style="width: 200px; height: 50px; border-bottom: 1px solid #CBD5E1; margin-top: 8px;"></div>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 13px; color: #64748B;">Dr {{doctor_name}}</p>
      <div style="width: 200px; height: 50px; border-bottom: 1px solid #CBD5E1; margin-top: 8px;"></div>
    </div>
  </div>
</div>`
}
