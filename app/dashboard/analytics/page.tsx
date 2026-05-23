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

      // Consultations by treatment
      const byTreatment = []
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

      setData({ totalPatients, newPatients, totalConsults, pendingExec, byTreatment, sourceData, channelMap, monthTrend })
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
    </div>
  )
}
