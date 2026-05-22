'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['var(--blue)', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2']

export default function AnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState<'7d'|'30d'|'90d'>('30d')
  const [kpis, setKpis]       = useState({ patients:0, consultations:0, appointments:0, messages:0 })
  const [byTreatment, setByTreatment] = useState<any[]>([])
  const [trend, setTrend]     = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days = period==='7d'?7:period==='30d'?30:90
      const since = new Date(Date.now() - days*86400000).toISOString()

      const [
        { count: totalP },
        { count: totalC },
        { count: totalA },
        { count: totalM },
        { data: treatments },
        { data: patients },
      ] = await Promise.all([
        supabase.from('patients').select('*',{count:'exact',head:true}).gte('created_at',since),
        supabase.from('consultations').select('*',{count:'exact',head:true}).gte('created_at',since),
        supabase.from('appointments').select('*',{count:'exact',head:true}).gte('created_at',since),
        supabase.from('workflow_executions').select('*',{count:'exact',head:true}).eq('status','sent').gte('created_at',since),
        supabase.from('treatments').select('id,name,color'),
        supabase.from('patients').select('source,created_at').gte('created_at',since),
      ])

      setKpis({ patients:totalP??0, consultations:totalC??0, appointments:totalA??0, messages:totalM??0 })

      // By treatment
      const byT: any[] = []
      for (const t of (treatments??[])) {
        const { count } = await supabase.from('consultations').select('*',{count:'exact',head:true}).eq('treatment_id',t.id).gte('created_at',since)
        if ((count??0)>0) byT.push({ name:t.name.split(' ')[0], count:count??0, color:t.color })
      }
      setByTreatment(byT)

      // Trend (group by week or day)
      const grouped: Record<string,number> = {}
      ;(patients??[]).forEach(p => {
        const d = new Date(p.created_at)
        const key = period==='7d'
          ? d.toLocaleDateString('fr-FR',{weekday:'short'})
          : `S${Math.ceil((d.getDate())/7)}`
        grouped[key] = (grouped[key]??0)+1
      })
      setTrend(Object.entries(grouped).map(([name,value])=>({name,value})))

      // Sources
      const srcMap: Record<string,number> = {}
      ;(patients??[]).forEach(p => { srcMap[p.source??'manual'] = (srcMap[p.source??'manual']??0)+1 })
      setSources(Object.entries(srcMap).map(([name,value])=>({name: name==='doctolib'?'Doctolib':'Manuel', value})))

      setLoading(false)
    }
    load()
  }, [period])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Analytiques</div>
          <div className="page-subtitle">Vue d&apos;ensemble de l&apos;activité de la clinique</div>
        </div>
        {/* Period selector */}
        <div style={{ display:'flex', gap:4, background:'var(--gray-100)', borderRadius:8, padding:4 }}>
          {(['7d','30d','90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding:'5px 12px', borderRadius:6, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', background: period===p ? 'white' : 'transparent', color: period===p ? 'var(--gray-900)' : 'var(--gray-500)', boxShadow: period===p ? '0 1px 3px rgba(0,0,0,.08)' : 'none', transition:'all .1s' }}>
              {p==='7d'?'7 jours':p==='30d'?'30 jours':'90 jours'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {[
            { label:'Nouveaux patients',  value:kpis.patients,      icon:'◎', color:'var(--blue)',    bg:'var(--blue-light)'  },
            { label:'Consultations',      value:kpis.consultations,  icon:'✦', color:'#7C3AED',        bg:'#F3EEFF'           },
            { label:'Rendez-vous',        value:kpis.appointments,   icon:'◫', color:'#059669',        bg:'#ECFDF5'           },
            { label:'Messages envoyés',   value:kpis.messages,       icon:'⚡', color:'#D97706',        bg:'#FFFBEB'           },
          ].map((k,i) => (
            <div key={i} className="card" style={{ padding:'18px 20px' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:k.color, marginBottom:12 }}>{k.icon}</div>
              <div style={{ fontSize:28, fontWeight:700, color:'var(--gray-900)', lineHeight:1 }}>{k.value}</div>
              <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:5, fontWeight:500 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Trend */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Nouveaux patients</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>Évolution sur la période</div>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--blue)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--gray-500)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--gray-500)' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }}/>
                  <Area type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={2} fill="url(#grad)"/>
                </AreaChart>
              </ResponsiveContainer>
            ) : <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-300)', fontSize:13 }}>Pas de données</div>}
          </div>

          {/* By treatment */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Consultations par traitement</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>Répartition sur la période</div>
            {byTreatment.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byTreatment} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--gray-500)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--gray-500)' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {byTreatment.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-300)', fontSize:13 }}>Pas de données</div>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Sources */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Sources patients</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>D&apos;où viennent vos patients</div>
            {sources.length > 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={sources} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {sources.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius:8, border:'1px solid var(--gray-200)', fontSize:12 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {sources.map((s,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:3, background:COLORS[i%COLORS.length], flexShrink:0 }}/>
                      <span style={{ fontSize:13, color:'var(--gray-700)' }}>{s.name}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)', marginLeft:'auto' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-300)', fontSize:13 }}>Pas de données</div>}
          </div>

          {/* Funnel */}
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)', marginBottom:4 }}>Entonnoir de conversion</div>
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:20 }}>Patient → Consultation → RDV</div>
            {[
              { label:'Patients', value:kpis.patients, color:'var(--blue)' },
              { label:'Consultations', value:kpis.consultations, color:'#7C3AED' },
              { label:'Rendez-vous', value:kpis.appointments, color:'#059669' },
            ].map((step, i, arr) => {
              const pct = i===0 ? 100 : arr[0].value>0 ? Math.round(step.value/arr[0].value*100) : 0
              return (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'var(--gray-700)' }}>{step.label}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>{step.value} <span style={{ fontSize:11, color:'var(--gray-400)', fontWeight:400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ background:'var(--gray-100)', borderRadius:99, height:8, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:step.color, borderRadius:99, transition:'width .5s ease' }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
