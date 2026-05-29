'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, Area, AreaChart } from 'recharts'

export default function AnalyticsPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d'|'30d'|'90d'>('30d')

  useEffect(() => {
    async function load() {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const since = new Date(); since.setDate(since.getDate() - days)
      const sinceISO = since.toISOString()

      const [
        { count: totalPatients },
        { count: newPatients },
        { count: totalConsults },
        { count: pendingExec },
        { data: treatments },
        { data: patientsBySource },
      ] = await Promise.all([
        supabase.from('patients').select('*', { count:'exact', head:true }),
        supabase.from('patients').select('*', { count:'exact', head:true }).gte('created_at', sinceISO),
        supabase.from('consultations').select('*', { count:'exact', head:true }).gte('created_at', sinceISO),
        supabase.from('workflow_executions').select('*', { count:'exact', head:true }).eq('status','pending'),
        supabase.from('treatments').select('id, name, color'),
        supabase.from('patients').select('source'),
      ])

      // Consultations by treatment + acte_type breakdown
      const byTreatment = []
      // Also get acte_type breakdown (from specialized consultations)
      const { data: acteData } = await supabase.from('consultations').select('acte_type, devis_montant')
      const acteMap: Record<string,{count:number;ca:number}> = {}
      ;(acteData ?? []).forEach((c: any) => {
        if (c.acte_type) {
          if (!acteMap[c.acte_type]) acteMap[c.acte_type] = { count: 0, ca: 0 }
          acteMap[c.acte_type].count++
          acteMap[c.acte_type].ca += c.devis_montant ?? 0
        }
      })
      if (treatments) {
        for (const t of treatments) {
          const { count } = await supabase.from('consultations').select('*', { count:'exact', head:true }).eq('treatment_id', t.id)
          if ((count ?? 0) > 0) byTreatment.push({ name: t.name.split(' ').slice(0,2).join(' '), count: count ?? 0, color: t.color })
        }
      }

      // Source breakdown
      const sourceMap: Record<string,number> = {}
      ;(patientsBySource ?? []).forEach((p: any) => { sourceMap[p.source] = (sourceMap[p.source]||0)+1 })
      const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name: name === 'doctolib' ? 'Doctolib' : 'Manuel', value }))

      // Executions breakdown
      const { data: execData } = await supabase.from('workflow_executions').select('status, step:workflow_steps(type)')
      const channelMap: Record<string,{sent:number;failed:number}> = {}
      ;(execData ?? []).forEach((e: any) => {
        const ch = e.step?.type ?? 'other'
        if (!channelMap[ch]) channelMap[ch] = { sent:0, failed:0 }
        if (e.status === 'sent') channelMap[ch].sent++
        if (e.status === 'failed') channelMap[ch].failed++
      })

      // Monthly trend (last 6 months)
      const monthTrend = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        const end   = new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59).toISOString()
        const { count: c } = await supabase.from('patients').select('*', { count:'exact', head:true }).gte('created_at', start).lte('created_at', end)
        monthTrend.push({ month: d.toLocaleDateString('fr-FR', { month:'short' }), patients: c ?? 0 })
      }

      setData({ totalPatients, newPatients, totalConsults, pendingExec, byTreatment, acteMap, sourceData, channelMap, monthTrend })
      setLoading(false)
    }
    load()
  }, [period])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  const channels = Object.entries(data.channelMap)
  const typeIcon: Record<string,string> = { email:'📧', whatsapp:'💬', docusign:'✍️', document:'📄', sms:'📱' }
  const typeColor: Record<string,string> = { email:'#1D4ED8', whatsapp:'#166534', docusign:'#6B21A8', document:'#475569', sms:'#92400E' }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Analytiques</div>
          <div className="page-subtitle">Vue d'ensemble de votre activité clinique</div>
        </div>
        <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:8, padding:3 }}>
          {(['7d','30d','90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, background: period===p ? 'white' : 'transparent', color: period===p ? 'var(--gray-900)' : 'var(--gray-500)', boxShadow: period===p ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition:'all .1s' }}>
              {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'Patients total',       value: data.totalPatients ?? 0, sub:`+${data.newPatients} cette période`, icon:'◎', color:'var(--blue)', bg:'var(--blue-light)' },
            { label:'Consultations',        value: data.totalConsults ?? 0,  sub:'Cette période',                     icon:'✦', color:'#7C3AED', bg:'#F3EEFF' },
            { label:'Actions en attente',   value: data.pendingExec ?? 0,    sub:'Automatisations',                   icon:'⚡', color:'#D97706', bg:'#FFFBEB' },
            { label:'Traitements actifs',   value: data.byTreatment.length,  sub:'Parcours configurés',              icon:'⬡', color:'#059669', bg:'#ECFDF5' },
          ].map((k,i) => (
            <div key={i} className="stat-card">
              <div style={{ width:34, height:34, borderRadius:9, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:k.color, marginBottom:10 }}>{k.icon}</div>
              <div className="stat-value">{k.value}</div>
              <div className="stat-label">{k.label}</div>
              <div style={{ fontSize:11, color:'var(--green)', fontWeight:500, marginTop:5 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16 }}>
          {/* Monthly trend */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Nouveaux patients — 6 mois</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>Évolution mensuelle</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.monthTrend} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }} />
                <Area type="monotone" dataKey="patients" stroke="var(--blue)" strokeWidth={2.5} fill="url(#grad)" name="Patients" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Source breakdown */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Sources d'acquisition</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>Origine des patients</div>
            {data.sourceData.length === 0 ? (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-400)', fontSize:13 }}>Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.sourceData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {data.sourceData.map((_:any, i:number) => <Cell key={i} fill={i===0?'var(--blue)':'var(--gray-300)'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* By treatment */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:16 }}>Consultations par traitement</div>
            {data.byTreatment.length === 0 ? (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-400)', fontSize:13 }}>Aucune consultation encore</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.byTreatment} barSize={28} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }} />
                  <Bar dataKey="count" radius={[4,4,0,0]} name="Consultations">
                    {data.byTreatment.map((e:any,i:number) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Channel performance */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Canaux d'automatisation</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>Envois réussis vs échoués</div>
            {channels.length === 0 ? (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-400)', fontSize:13 }}>Aucune automatisation encore</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {channels.map(([ch, stats]: any) => {
                  const total = stats.sent + stats.failed
                  const pct = total > 0 ? Math.round(stats.sent / total * 100) : 0
                  const color = typeColor[ch] ?? 'var(--blue)'
                  return (
                    <div key={ch}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12.5, fontWeight:500, color:'var(--gray-700)', display:'flex', alignItems:'center', gap:6 }}>
                          {typeIcon[ch] ?? '📨'} {ch.charAt(0).toUpperCase()+ch.slice(1)}
                        </span>
                        <span style={{ fontSize:11, color:'var(--gray-500)' }}>{stats.sent}/{total} · {pct}%</span>
                      </div>
                      <div style={{ height:6, background:'var(--gray-100)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', background:color, borderRadius:99, width:`${pct}%`, transition:'width .5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Répartition Sankey des traitements ── */}
      <SankeyTreatments byTreatment={data.byTreatment ?? []} acteMap={data.acteMap ?? {}} />
    </div>
  )
}

// ── Sankey inline component ────────────────────────────────────────────────
function SankeyTreatments({ byTreatment, acteMap }: { byTreatment: any[]; acteMap: Record<string,{count:number;ca:number}> }) {
  const POLE_COLORS: Record<string, string> = {
    'Laser': '#E879B0', 'Greffe': '#D97706', 'Acide': '#7C3AED',
    'Botox': '#6366F1', 'Peeling': '#059669', 'Injection': '#7C3AED',
    'Rhinoplastie': '#059669', 'Chirurgie': '#059669',
  }

  // Build nodes from real data
  const allItems: { label: string; count: number; color: string; isActe: boolean }[] = []
  
  // From treatments (linked to consultations)
  byTreatment.forEach((t, i) => {
    const colors = ['#4F8EF7','#22C55E','#E879B0','#F59E0B','#8B5CF6','#EF4444','#0891B2','#10B981']
    allItems.push({ label: t.name, count: t.count, color: colors[i % colors.length], isActe: false })
  })
  
  // From acte_type (specialized consultations)
  Object.entries(acteMap).forEach(([acte, stats], i) => {
    const colors = ['#6366F1','#F97316','#14B8A6','#F43F5E','#84CC16','#A855F7']
    if (!allItems.find(a => a.label.toLowerCase().includes(acte.toLowerCase().slice(0,6)))) {
      allItems.push({ label: acte, count: stats.count, color: colors[i % colors.length], isActe: true })
    }
  })

  const total = allItems.reduce((s, i) => s + i.count, 0)
  
  if (allItems.length === 0) return null

  // Sort by count
  allItems.sort((a, b) => b.count - a.count)

  const SVG_W = 640, BAR_H = 40, GAP = 10, PADDING_TOP = 30
  const SVG_H = allItems.length * (BAR_H + GAP) + PADDING_TOP + 20
  const LEFT_W = 120, RIGHT_X = LEFT_W + 220, RIGHT_W = 160
  const TOTAL_H = allItems.reduce((s) => s + BAR_H, 0) + (allItems.length - 1) * GAP

  return (
    <div className="card" style={{ padding: '20px 24px', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>Répartition des traitements</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{total} consultations · {allItems.length} traitement{allItems.length > 1 ? 's' : ''}</div>
        </div>
        <span style={{ fontSize: 11, background: 'var(--blue-light)', color: 'var(--blue-dark)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
          Données réelles
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block', minWidth: 400 }}>
          {/* Titre colonnes */}
          <text x={LEFT_W / 2} y={16} textAnchor="middle" fontSize={9} fontWeight="700" fill="#9CA3AF" fontFamily="-apple-system,sans-serif" letterSpacing="1">CLINIQUE</text>
          <text x={RIGHT_X + RIGHT_W / 2} y={16} textAnchor="middle" fontSize={9} fontWeight="700" fill="#9CA3AF" fontFamily="-apple-system,sans-serif" letterSpacing="1">TRAITEMENTS</text>

          {/* Bloc clinique global */}
          <rect x={0} y={PADDING_TOP} width={LEFT_W} height={TOTAL_H} fill="#0F172A" rx={8} />
          <text x={LEFT_W / 2} y={PADDING_TOP + TOTAL_H / 2 - 8} textAnchor="middle" fontSize={11} fontWeight="700" fill="white" fontFamily="-apple-system,sans-serif">Ma Clinique</text>
          <text x={LEFT_W / 2} y={PADDING_TOP + TOTAL_H / 2 + 8} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.6)" fontFamily="-apple-system,sans-serif">{total} consultations</text>

          {/* Rubans + barres droite */}
          {allItems.map((item, i) => {
            const y = PADDING_TOP + i * (BAR_H + GAP)
            const h = BAR_H
            // Source point (on right edge of left block)
            const srcY = PADDING_TOP + (i / allItems.length) * TOTAL_H
            const srcH = TOTAL_H / allItems.length
            const cx = (LEFT_W + RIGHT_X) / 2

            return (
              <g key={item.label}>
                {/* Ribbon */}
                <path
                  d={`M ${LEFT_W} ${srcY} C ${cx} ${srcY}, ${cx} ${y}, ${RIGHT_X} ${y}
                      L ${RIGHT_X} ${y + h}
                      C ${cx} ${y + h}, ${cx} ${srcY + srcH}, ${LEFT_W} ${srcY + srcH} Z`}
                  fill={item.color}
                  opacity={0.18}
                />
                {/* Color bar left */}
                <rect x={LEFT_W - 4} y={srcY} width={4} height={srcH} fill={item.color} rx={1} />
                {/* Bar right */}
                <rect x={RIGHT_X} y={y} width={6} height={h} fill={item.color} rx={2} />
                {/* Label card */}
                <rect x={RIGHT_X + 10} y={y} width={RIGHT_W - 12} height={h} fill="#F9FAFB" rx={6} />
                <text x={RIGHT_X + 18} y={y + h / 2 - 4} fontSize={11} fontWeight="600" fill="#111827" fontFamily="-apple-system,sans-serif">
                  {item.label.length > 18 ? item.label.slice(0, 17) + '…' : item.label}
                </text>
                <text x={RIGHT_X + 18} y={y + h / 2 + 9} fontSize={10} fill="#6B7280" fontFamily="-apple-system,sans-serif">
                  {item.count} consultation{item.count > 1 ? 's' : ''}
                  {total > 0 ? ` · ${Math.round(item.count / total * 100)}%` : ''}
                </text>
                {/* Color pip right */}
                <rect x={RIGHT_X + RIGHT_W - 4} y={y + 2} width={3} height={h - 4} fill={item.color} rx={1} />
              </g>
            )
          })}
        </svg>
      </div>

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-400)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          Aucune consultation enregistrée encore — les données apparaîtront ici automatiquement.
        </div>
      )}
    </div>
  )
}
