'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Node type definitions ────────────────────────────────────────────────────
const NODE_TYPES: Record<string, NodeTypeDef> = {
  trigger:          { label:'Déclencheur',        icon:'⚡', color:'#D97706', bg:'#FFFBEB', category:'trigger',  description:'Point de départ du workflow' },
  email:            { label:'Envoyer Email',       icon:'📧', color:'#1D4ED8', bg:'#EFF6FF', category:'action',   description:'Email via Resend ou Gmail' },
  whatsapp:         { label:'WhatsApp',            icon:'💬', color:'#166534', bg:'#F0FDF4', category:'action',   description:'Message WhatsApp via Twilio' },
  sms:              { label:'SMS',                 icon:'📱', color:'#92400E', bg:'#FFFBEB', category:'action',   description:'SMS via Twilio' },
  generate_pdf:     { label:'Générer PDF',         icon:'📄', color:'#475569', bg:'#F8FAFC', category:'action',   description:'Génère un document depuis un template' },
  yousign:          { label:'Faire signer',        icon:'✍️', color:'#6B21A8', bg:'#FAF5FF', category:'action',   description:'Envoie pour signature via Yousign' },
  send_intake_form: { label:'Formulaire Patient',  icon:'📋', color:'#059669', bg:'#F0FDF4', category:'action',   description:'Envoie le formulaire de dossier' },
  create_appointment:{ label:'Créer un RDV',       icon:'📅', color:'#0891B2', bg:'#ECFEFF', category:'action',  description:'Crée un RDV dans l\'agenda' },
  notify_team:      { label:'Notifier l\'équipe',  icon:'🔔', color:'#475569', bg:'#F8FAFC', category:'action',   description:'Notification interne à l\'équipe' },
  webhook:          { label:'Webhook',             icon:'🔗', color:'#475569', bg:'#F8FAFC', category:'action',   description:'Appel HTTP vers n8n, Zapier...' },
  google_sheets:    { label:'Google Sheets',       icon:'📊', color:'#0F9D58', bg:'#E8F5E9', category:'action',   description:'Ajoute une ligne dans Sheets' },
  slack:            { label:'Slack',               icon:'💬', color:'#4A154B', bg:'#F9F0FA', category:'action',   description:'Message dans un canal Slack' },
  delay:            { label:'Délai',               icon:'⏰', color:'#D97706', bg:'#FFFBEB', category:'control',  description:'Attendre X jours/heures' },
  condition:        { label:'Condition (Si/Sinon)', icon:'🔀', color:'#DC2626', bg:'#FEF2F2', category:'control', description:'Branche le flow selon une condition' },
  loop:             { label:'Boucle',              icon:'🔁', color:'#7C3AED', bg:'#FAF5FF', category:'control',  description:'Répéter jusqu\'à condition' },
}

type NodeTypeDef = { label:string; icon:string; color:string; bg:string; category:string; description:string }

type FlowNode = {
  id: string
  type: string
  label: string
  icon: string
  x: number
  y: number
  config: Record<string, any>
}

type FlowEdge = { from: string; to: string; branch?: 'true'|'false' }

// ─── Node config forms ────────────────────────────────────────────────────────
function NodeConfigPanel({ node, onChange, onDelete, treatments, templates, appConnections }: {
  node: FlowNode
  onChange: (config: Record<string,any>, label?: string) => void
  onDelete: () => void
  treatments: any[]
  templates: any[]
  appConnections: any[]
}) {
  const def = NODE_TYPES[node.type]
  const [config, setConfig] = useState(node.config)
  const [label, setLabel]   = useState(node.label)
  const up = (k: string, v: any) => { const c = { ...config, [k]: v }; setConfig(c); onChange(c, label) }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:def.bg, borderRadius:10, border:`1px solid ${def.color}20` }}>
        <span style={{ fontSize:22 }}>{def.icon}</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:def.color }}>{def.label}</div>
          <div style={{ fontSize:11, color:'var(--gray-500)' }}>{def.description}</div>
        </div>
      </div>

      <div>
        <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Nom affiché</label>
        <input className="input" value={label} onChange={e => { setLabel(e.target.value); onChange(config, e.target.value) }} style={{ fontSize:13 }} />
      </div>

      {/* EMAIL config */}
      {node.type === 'email' && (
        <>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Sujet</label>
            <input className="input" value={config.subject ?? ''} onChange={e => up('subject', e.target.value)} placeholder="Votre RDV approche — {{clinic_name}}" style={{ fontSize:13 }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Corps du message</label>
            <textarea className="input" value={config.body ?? ''} onChange={e => up('body', e.target.value)} rows={5} style={{ resize:'vertical', fontSize:13, lineHeight:1.6 }} placeholder="Bonjour {{first_name}},&#10;&#10;..." />
            <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:4 }}>Variables : {'{{first_name}}'} {'{{patient_name}}'} {'{{clinic_name}}'} {'{{intake_link}}'}</div>
          </div>
        </>
      )}

      {/* WHATSAPP / SMS config */}
      {(node.type === 'whatsapp' || node.type === 'sms') && (
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Message</label>
          <textarea className="input" value={config.body ?? ''} onChange={e => up('body', e.target.value)} rows={4} style={{ resize:'vertical', fontSize:13, lineHeight:1.6 }} placeholder="Bonjour {{first_name}}, ..." />
          <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:4 }}>Variables : {'{{first_name}}'} {'{{patient_name}}'} {'{{intake_link}}'}</div>
        </div>
      )}

      {/* DELAY config */}
      {node.type === 'delay' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Jours</label>
            <input className="input" type="number" value={config.days ?? 0} onChange={e => up('days', parseInt(e.target.value) || 0)} style={{ fontSize:13 }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Heures</label>
            <input className="input" type="number" value={config.hours ?? 0} onChange={e => up('hours', parseInt(e.target.value) || 0)} min={0} max={23} style={{ fontSize:13 }} />
          </div>
          {(config.days || 0) + (config.hours || 0) > 0 && (
            <div style={{ gridColumn:'span 2', fontSize:12, color:'var(--blue)', background:'var(--blue-light)', padding:'6px 10px', borderRadius:6 }}>
              ⏰ Attendra {config.days > 0 ? `${config.days} jour${config.days > 1 ? 's' : ''}` : ''}{config.hours > 0 ? ` ${config.hours}h` : ''} avant le nœud suivant
            </div>
          )}
        </div>
      )}

      {/* CONDITION config */}
      {node.type === 'condition' && (
        <>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Champ à tester</label>
            <select className="input" value={config.field ?? ''} onChange={e => up('field', e.target.value)} style={{ fontSize:13 }}>
              <option value="">Choisir...</option>
              <option value="document_status">Statut du document</option>
              <option value="intake_status">Formulaire patient</option>
              <option value="journey_stage">Étape du parcours</option>
              <option value="patient_email">Email renseigné</option>
              <option value="patient_phone">Téléphone renseigné</option>
              <option value="treatment_id">Traitement spécifique</option>
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Opérateur</label>
              <select className="input" value={config.operator ?? 'equals'} onChange={e => up('operator', e.target.value)} style={{ fontSize:13 }}>
                <option value="equals">Est égal à</option>
                <option value="not_equals">N'est pas</option>
                <option value="exists">Existe</option>
                <option value="not_exists">N'existe pas</option>
                <option value="contains">Contient</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Valeur</label>
              <input className="input" value={config.value ?? ''} onChange={e => up('value', e.target.value)} placeholder="signed, completed..." style={{ fontSize:13 }} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div style={{ padding:'8px 10px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:7, fontSize:11, color:'#166534', fontWeight:600, textAlign:'center' }}>
              ✅ Si vrai → branche "true"
            </div>
            <div style={{ padding:'8px 10px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:7, fontSize:11, color:'#DC2626', fontWeight:600, textAlign:'center' }}>
              ❌ Si faux → branche "false"
            </div>
          </div>
        </>
      )}

      {/* PDF config */}
      {node.type === 'generate_pdf' && (
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Template</label>
          <select className="input" value={config.template_id ?? ''} onChange={e => up('template_id', e.target.value)} style={{ fontSize:13 }}>
            <option value="">Choisir un template...</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* WEBHOOK config */}
      {node.type === 'webhook' && (
        <>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>URL du webhook</label>
            <input className="input" value={config.url ?? ''} onChange={e => up('url', e.target.value)} placeholder="https://hooks.zapier.com/..." style={{ fontSize:13 }} />
            <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:4 }}>Compatible n8n, Zapier, Make, Slack, ou toute URL HTTP POST</div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Payload JSON (optionnel)</label>
            <textarea className="input" value={config.payload ?? ''} onChange={e => up('payload', e.target.value)} rows={3} placeholder='{"patient": "{{patient_name}}", "email": "{{email}}"}' style={{ fontSize:12, fontFamily:'monospace', resize:'vertical' }} />
          </div>
        </>
      )}

      {/* GOOGLE SHEETS config */}
      {node.type === 'google_sheets' && (
        <>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>ID du Spreadsheet</label>
            <input className="input" value={config.spreadsheet_id ?? ''} onChange={e => up('spreadsheet_id', e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" style={{ fontSize:12 }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Colonnes à remplir</label>
            <input className="input" value={config.columns ?? ''} onChange={e => up('columns', e.target.value)} placeholder="Date,Nom,Email,Traitement" style={{ fontSize:13 }} />
          </div>
        </>
      )}

      {/* SLACK config */}
      {node.type === 'slack' && (
        <>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Webhook Slack</label>
            <input className="input" value={config.webhook_url ?? ''} onChange={e => up('webhook_url', e.target.value)} placeholder="https://hooks.slack.com/services/..." style={{ fontSize:12 }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 }}>Message</label>
            <textarea className="input" value={config.message ?? ''} onChange={e => up('message', e.target.value)} rows={3} placeholder="Nouveau patient : {{patient_name}} — {{treatment_name}}" style={{ fontSize:13 }} />
          </div>
        </>
      )}

      <button onClick={onDelete} style={{ width:'100%', padding:'9px', borderRadius:8, border:'1px solid #FECACA', background:'#FFF5F5', color:'#DC2626', cursor:'pointer', fontSize:13, fontWeight:500, marginTop:4 }}>
        🗑 Supprimer ce nœud
      </button>
    </div>
  )
}

// ─── Main builder ─────────────────────────────────────────────────────────────
export default function FlowBuilderPage() {
  const { id } = useParams()
  const router  = useRouter()
  const supabase = createClient()
  const canvasRef = useRef<HTMLDivElement>(null)

  const [flow, setFlow]         = useState<any>(null)
  const [nodes, setNodes]       = useState<FlowNode[]>([])
  const [edges, setEdges]       = useState<FlowEdge[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [dragging, setDragging]     = useState<{id:string;ox:number;oy:number}|null>(null)
  const [connectFrom, setConnectFrom] = useState<string|null>(null)
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [pickerPos, setPickerPos] = useState({ x:0, y:0 })
  const [treatments, setTreatments]   = useState<any[]>([])
  const [templates, setTemplates]     = useState<any[]>([])
  const [appConnections, setAppConnections] = useState<any[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan]   = useState({ x:0, y:0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{x:number;y:number;px:number;py:number}|null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
      if (!prof) return

      const [{ data: wf }, { data: trts }, { data: tmpl }, { data: apps }] = await Promise.all([
        supabase.from('workflow_definitions').select('*').eq('id', id as string).single(),
        supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id),
        supabase.from('document_templates').select('id,name,type').eq('clinic_id', prof.clinic_id),
        supabase.from('app_connections').select('*').eq('clinic_id', prof.clinic_id),
      ])

      if (wf) {
        setFlow(wf)
        setNodes(wf.nodes ?? [])
        setEdges(wf.edges ?? [])
      }
      setTreatments(trts ?? [])
      setTemplates(tmpl ?? [])
      setAppConnections(apps ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  const save = useCallback(async (n = nodes, e = edges) => {
    setSaving(true)
    await supabase.from('workflow_definitions').update({ nodes: n, edges: e, updated_at: new Date().toISOString() }).eq('id', id as string)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [nodes, edges, id])

  function addNode(type: string, x: number, y: number) {
    const def = NODE_TYPES[type]
    const newNode: FlowNode = {
      id: `${type}_${Date.now()}`,
      type, icon: def.icon, label: def.label,
      x, y, config: {}
    }
    const n = [...nodes, newNode]
    setNodes(n)
    setSelectedId(newNode.id)
    setShowNodePicker(false)
    save(n, edges)
  }

  function updateNode(nodeId: string, config: Record<string,any>, label?: string) {
    const n = nodes.map(nd => nd.id === nodeId ? { ...nd, config, ...(label ? { label } : {}) } : nd)
    setNodes(n)
  }

  function deleteNode(nodeId: string) {
    const n = nodes.filter(nd => nd.id !== nodeId)
    const e = edges.filter(ed => ed.from !== nodeId && ed.to !== nodeId)
    setNodes(n)
    setEdges(e)
    setSelectedId(null)
    save(n, e)
  }

  function connectNodes(fromId: string, toId: string) {
    if (fromId === toId) return
    if (edges.some(e => e.from === fromId && e.to === toId)) return
    const e = [...edges, { from: fromId, to: toId }]
    setEdges(e)
    setConnectFrom(null)
    save(nodes, e)
  }

  function deleteEdge(fromId: string, toId: string) {
    const e = edges.filter(ed => !(ed.from === fromId && ed.to === toId))
    setEdges(e)
    save(nodes, e)
  }

  const selectedNode = nodes.find(n => n.id === selectedId)

  const categories = ['trigger', 'action', 'control']
  const catLabels: Record<string,string> = { trigger:'Déclencheurs', action:'Actions', control:'Contrôle' }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--gray-50)' }}>
      {/* Toolbar */}
      <div style={{ height:52, background:'white', borderBottom:'1px solid var(--gray-200)', display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, zIndex:10 }}>
        <Link href="/dashboard/flows" style={{ color:'var(--gray-500)', textDecoration:'none', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>← Workflows</Link>
        <span style={{ color:'var(--gray-300)' }}>|</span>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{flow?.name}</div>
        <div style={{ flex:1 }} />
        {/* Zoom controls */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button onClick={() => setZoom(z => Math.max(0.4, z-0.1))} style={{ width:26, height:26, borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:14 }}>−</button>
          <span style={{ fontSize:11, color:'var(--gray-500)', minWidth:40, textAlign:'center', fontWeight:500 }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z+0.1))} style={{ width:26, height:26, borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', fontSize:14 }}>+</button>
          <button onClick={() => { setZoom(1); setPan({x:0,y:0}) }} style={{ fontSize:10, padding:'4px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-500)' }}>Reset</button>
        </div>
        <div style={{ width:1, height:20, background:'var(--gray-200)' }} />
        <button onClick={() => setShowNodePicker(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1px solid var(--blue-mid)', background:'var(--blue-light)', color:'var(--blue)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
          + Ajouter un nœud
        </button>
        <button onClick={() => save()} disabled={saving} className="btn-primary" style={{ fontSize:12, padding:'6px 14px' }}>
          {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
        <button onClick={async () => {
          await supabase.from('workflow_definitions').update({ is_active: !flow?.is_active }).eq('id', id as string)
          setFlow((f: any) => ({ ...f, is_active: !f.is_active }))
        }} style={{ fontSize:12, padding:'6px 14px', borderRadius:8, border:'none', background: flow?.is_active ? '#FEF2F2' : '#F0FDF4', color: flow?.is_active ? '#DC2626' : '#059669', cursor:'pointer', fontWeight:600 }}>
          {flow?.is_active ? '⏸ Désactiver' : '▶ Activer'}
        </button>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Canvas */}
        <div ref={canvasRef}
          style={{ flex:1, position:'relative', overflow:'hidden', cursor: isPanning ? 'grabbing' : connectFrom ? 'crosshair' : 'grab' }}
          onMouseDown={e => {
            // Middle click OR left click on background (not on a node)
            const target = e.target as HTMLElement
            const onBackground = target === canvasRef.current || target.classList.contains('canvas-bg')
            if (e.button === 1 || (e.button === 0 && onBackground && !connectFrom)) {
              e.preventDefault()
              setIsPanning(true)
              panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
            }
          }}
          onMouseMove={e => {
            if (!isPanning || !panStart.current) return
            const dx = e.clientX - panStart.current.x
            const dy = e.clientY - panStart.current.y
            setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy })
          }}
          onMouseUp={e => {
            if (isPanning) { setIsPanning(false); panStart.current = null; return }
            if (connectFrom) { setConnectFrom(null); return }
          }}
          onMouseLeave={() => { setIsPanning(false); panStart.current = null }}
          onWheel={e => {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.08 : 0.08
            setZoom(z => Math.min(2, Math.max(0.3, z + delta)))
          }}
          onClick={e => {
            if (isPanning) return
            if (connectFrom) { setConnectFrom(null); return }
            if ((e.target as HTMLElement) === canvasRef.current) { setSelectedId(null) }
          }}>
          {/* Grid background */}
          <div className='canvas-bg' style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle, #CBD5E1 1px, transparent 1px)', backgroundSize:'24px 24px', opacity:.4 }} />

          {/* SVG edges */}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
            {edges.map((edge, i) => {
              const from = nodes.find(n => n.id === edge.from)
              const to   = nodes.find(n => n.id === edge.to)
              if (!from || !to) return null
              const fx = (from.x + 160) * zoom + pan.x
              const fy = (from.y + 28)  * zoom + pan.y
              const tx = to.x * zoom + pan.x
              const ty = (to.y + 28) * zoom + pan.y
              const mx = (fx + tx) / 2
              return (
                <g key={i}>
                  <path d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`}
                    stroke={edge.branch === 'true' ? '#10B981' : edge.branch === 'false' ? '#EF4444' : '#94A3B8'}
                    strokeWidth={2} fill="none" strokeDasharray={edge.branch ? '6,3' : 'none'} />
                  {/* Arrow */}
                  <polygon points={`${tx},${ty} ${tx-8},${ty-5} ${tx-8},${ty+5}`}
                    fill={edge.branch === 'true' ? '#10B981' : edge.branch === 'false' ? '#EF4444' : '#94A3B8'} />
                  {edge.branch && (
                    <text x={mx} y={(fy+ty)/2-6} fontSize={10} fill={edge.branch==='true'?'#10B981':'#EF4444'} textAnchor="middle" fontWeight="600">{edge.branch==='true'?'✓ Oui':'✗ Non'}</text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Nodes */}
          <div style={{ position:'absolute', inset:0, transformOrigin:'0 0', transform:`scale(${zoom}) translate(${pan.x/zoom}px, ${pan.y/zoom}px)` }}>
            {nodes.map(node => {
              const def = NODE_TYPES[node.type]
              const isSelected = selectedId === node.id
              const isConnect  = connectFrom && connectFrom !== node.id

              return (
                <div key={node.id}
                  style={{
                    position:'absolute', left:node.x, top:node.y,
                    width:160, userSelect:'none',
                    filter: isSelected ? `drop-shadow(0 0 8px ${def.color}80)` : 'none',
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onClick={e => { e.stopPropagation(); if (connectFrom) connectNodes(connectFrom, node.id); else setSelectedId(node.id) }}
                  onMouseDown={e => {
                    if (e.button !== 0) return
                    const startX = e.clientX, startY = e.clientY
                    const ox = node.x, oy = node.y
                    const onMove = (ev: MouseEvent) => {
                      const dx = (ev.clientX - startX) / zoom
                      const dy = (ev.clientY - startY) / zoom
                      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, x: ox+dx, y: oy+dy } : n))
                    }
                    const onUp = () => {
                      document.removeEventListener('mousemove', onMove)
                      document.removeEventListener('mouseup', onUp)
                      setNodes(prev => { save(prev, edges); return prev })
                    }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                >
                  {/* Node card */}
                  <div style={{
                    background:'white', borderRadius:12,
                    border:`2px solid ${isSelected ? def.color : isConnect ? '#94A3B8' : '#E2E8F0'}`,
                    boxShadow:'0 2px 8px rgba(0,0,0,.08)',
                    overflow:'hidden', cursor:'grab',
                  }}>
                    {/* Header */}
                    <div style={{ padding:'8px 10px', background:def.bg, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{node.icon}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:def.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.label}</span>
                    </div>
                    {/* Body */}
                    <div style={{ padding:'6px 10px 8px' }}>
                      {node.type === 'delay' && node.config.days !== undefined && (
                        <div style={{ fontSize:11, color:'var(--gray-500)' }}>⏰ {node.config.days > 0 ? `J+${node.config.days}` : node.config.hours > 0 ? `+${node.config.hours}h` : 'Immédiat'}</div>
                      )}
                      {(node.type === 'email' || node.type === 'whatsapp') && node.config.subject && (
                        <div style={{ fontSize:10, color:'var(--gray-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.config.subject}</div>
                      )}
                      {(node.type === 'email' || node.type === 'whatsapp') && !node.config.subject && node.config.body && (
                        <div style={{ fontSize:10, color:'var(--gray-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.config.body.slice(0,40)}...</div>
                      )}
                      {node.type === 'condition' && node.config.field && (
                        <div style={{ fontSize:10, color:'var(--gray-400)' }}>Si {node.config.field} {node.config.operator} {node.config.value}</div>
                      )}
                      {node.type === 'webhook' && node.config.url && (
                        <div style={{ fontSize:10, color:'var(--gray-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>→ {node.config.url.replace('https://','')}</div>
                      )}
                      {!node.config.subject && !node.config.body && !node.config.days && !node.config.field && !node.config.url && node.type !== 'trigger' && (
                        <div style={{ fontSize:10, color:'#F59E0B' }}>⚠ À configurer</div>
                      )}
                    </div>
                    {/* Connection port */}
                    <div style={{ position:'absolute', right:-8, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', background:'white', border:`2px solid ${def.color}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}
                      onClick={e => { e.stopPropagation(); setConnectFrom(connectFrom === node.id ? null : node.id) }}
                      title="Connecter à un autre nœud">
                      <div style={{ width:6, height:6, borderRadius:'50%', background:connectFrom===node.id?def.color:'var(--gray-300)' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Connect mode hint */}
          {connectFrom && (
            <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'white', padding:'8px 16px', borderRadius:99, fontSize:12, fontWeight:500, boxShadow:'0 4px 12px rgba(0,0,0,.3)' }}>
              Cliquez sur un autre nœud pour connecter · Échap pour annuler
            </div>
          )}
        </div>

        {/* Right panel: node config or node picker */}
        <div style={{ width:280, background:'white', borderLeft:'1px solid var(--gray-200)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
          {showNodePicker ? (
            <div style={{ flex:1, overflow:'auto', padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-900)' }}>Ajouter un nœud</div>
                <button onClick={() => setShowNodePicker(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--gray-400)' }}>×</button>
              </div>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{catLabels[cat]}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {Object.entries(NODE_TYPES).filter(([,v]) => v.category === cat).map(([type, def]) => (
                      <button key={type} onClick={() => addNode(type, 200 + Math.random()*200, 150 + Math.random()*200)}
                        style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, border:`1px solid ${def.bg}`, background:def.bg, cursor:'pointer', textAlign:'left', transition:'all .1s' }}
                        onMouseEnter={e => e.currentTarget.style.border = `1px solid ${def.color}40`}
                        onMouseLeave={e => e.currentTarget.style.border = `1px solid ${def.bg}`}>
                        <span style={{ fontSize:17, flexShrink:0 }}>{def.icon}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:def.color }}>{def.label}</div>
                          <div style={{ fontSize:10, color:'var(--gray-500)' }}>{def.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedNode ? (
            <div style={{ flex:1, overflow:'auto', padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:12 }}>
                Configurer le nœud
              </div>
              <NodeConfigPanel
                node={selectedNode}
                onChange={(config, label) => updateNode(selectedNode.id, config, label)}
                onDelete={() => deleteNode(selectedNode.id)}
                treatments={treatments}
                templates={templates}
                appConnections={appConnections}
              />
              <button onClick={() => save()} style={{ width:'100%', marginTop:14, padding:'9px', borderRadius:8, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                💾 Sauvegarder
              </button>
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, textAlign:'center', color:'var(--gray-400)' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🖱️</div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-600)', marginBottom:6 }}>Sélectionnez un nœud</div>
              <div style={{ fontSize:12, marginBottom:20 }}>Cliquez sur un nœud pour le configurer ou connectez-les avec le bouton ●</div>
              <button onClick={() => setShowNodePicker(true)} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                + Ajouter un nœud
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
