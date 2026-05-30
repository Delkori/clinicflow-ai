'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      const [
        { data: todayAppts },
        { count: monthPatients },
        { count: monthConsults },
        { count: pendingActions },
        { data: recentPatients },
        { data: pendingExec },
        { data: activeJourneys },
        { data: facturesMois },
      ] = await Promise.all([
        supabase.from('appointments').select('*, patient:patients(first_name,last_name), treatment:treatments(name,color)').gte('appointment_date', todayStart).lte('appointment_date', todayEnd).order('appointment_date'),
        supabase.from('patients').select('*', { count:'exact', head:true }).gte('created_at', monthStart),
        supabase.from('consultations').select('*', { count:'exact', head:true }).gte('created_at', monthStart),
        supabase.from('workflow_executions').select('*', { count:'exact', head:true }).eq('status','pending'),
        supabase.from('patients').select('*').order('created_at', { ascending:false }).limit(5),
        supabase.from('workflow_executions').select('*, step:workflow_steps(type,template_name), patient:patients(first_name,last_name,phone)').eq('status','pending').not('step', 'is', null).order('scheduled_at').limit(6),
        supabase.from('patient_journeys').select('*, patient:patients(first_name,last_name), treatment:treatments(name,color)').order('updated_at', { ascending:false }).limit(5),
        supabase.from('factures').select('total_ttc').gte('date_emission', monthStart.split('T')[0]).eq('status', 'payee'),
      ])

      // 7-day trend
      const trend = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
        const de = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
        const { count } = await supabase.from('consultations').select('*', { count:'exact', head:true }).gte('created_at', ds).lte('created_at', de)
        trend.push({ day: ['D','L','M','M','J','V','S'][d.getDay()], v: count ?? 0 })
      }

      // Compute loyalty scores for recent patients
      const recentWithScores = await Promise.all((recentPatients ?? []).map(async (p: any) => {
        const [{ count: consultCount }, { count: docCount }] = await Promise.all([
          supabase.from('consultations').select('*', { count:'exact', head:true }).eq('patient_id', p.id),
          supabase.from('generated_documents').select('*', { count:'exact', head:true }).eq('patient_id', p.id),
        ])
        const daysSince = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
        const score = Math.min(100, Math.round(
          (consultCount ?? 0) * 25 +
          (docCount ?? 0) * 10 +
          (daysSince < 30 ? 20 : daysSince < 90 ? 10 : 0)
        ))
        return { ...p, loyaltyScore: score, consultCount: consultCount ?? 0 }
      }))

      const caMensuel = (facturesMois ?? []).reduce((s: number, f: any) => s + (f.total_ttc ?? 0), 0)
      setData({ todayAppts: todayAppts ?? [], monthPatients, monthConsults, pendingActions, recentPatients: recentWithScores, pendingExec: pendingExec ?? [], activeJourneys: activeJourneys ?? [], trend, caMensuel })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:'28px', height:'28px', border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:'700', color:'var(--gray-900)', letterSpacing:'-0.3px' }}>
            {greeting} 👋
          </div>
          <div style={{ fontSize:'13px', color:'var(--gray-500)', marginTop:'2px' }}>
            {now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })} · {data.todayAppts.length > 0 ? `${data.todayAppts.length} RDV aujourd'hui` : "Pas de RDV aujourd'hui"}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/salle-attente" style={{ textDecoration:'none', padding:'7px 14px', borderRadius:9, background:'#ECFEFF', color:'#0891B2', border:'1px solid #A5F3FC', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            🏥 Salle d'attente
          </Link>
          <Link href="/dashboard/consultations/new" className="btn-primary" style={{ textDecoration:'none' }}>
            + Nouvelle consultation
          </Link>
        </div>
      </div>

      <div className="page-content" style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
          {[
            { label:'CA ce mois', value: (data.caMensuel ?? 0) >= 1000 ? `${Math.round((data.caMensuel ?? 0)/1000)}k€` : `${Math.round(data.caMensuel ?? 0)}€`, icon:'💰', color:'#059669', bg:'#ECFDF5' },
            { label:'Patients ce mois', value: data.monthPatients ?? 0, icon:'◎', color:'var(--blue)', bg:'var(--blue-light)' },
            { label:'Consultations', value: data.monthConsults ?? 0, icon:'✦', color:'#7C3AED', bg:'#F3EEFF' },
            { label:'Actions en attente', value: data.pendingActions ?? 0, icon:'⚡', color:'#D97706', bg:'#FFFBEB', alert: (data.pendingActions ?? 0) > 0 },
            { label:"RDV aujourd'hui", value: data.todayAppts.length, icon:'◫', color:'#059669', bg:'#ECFDF5' },
          ].map((k,i) => (
            <div key={i} className="stat-card" style={{ position:'relative', overflow:'hidden' }}>
              {k.alert && <div style={{ position:'absolute', top:'10px', right:'10px', width:'8px', height:'8px', borderRadius:'50%', background:'#EF4444', animation:'pulse 2s infinite' }} />}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
              <div style={{ width:'34px', height:'34px', borderRadius:'9px', background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', color:k.color, marginBottom:'10px' }}>{k.icon}</div>
              <div className="stat-value">{k.value}</div>
              <div className="stat-label">{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:'16px' }}>
          {/* Today appointments */}
          <div className="card">
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)' }}>Agenda du jour</div>
              <Link href="/dashboard/agenda" style={{ fontSize:'12px', color:'var(--blue)', textDecoration:'none' }}>Voir tout →</Link>
            </div>
            {data.todayAppts.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center' }}>
                <div style={{ fontSize:'28px', marginBottom:'8px' }}>☀️</div>
                <div style={{ fontSize:'13px', color:'var(--gray-500)' }}>Aucun RDV aujourd'hui</div>
              </div>
            ) : (
              <div style={{ padding:'8px 0' }}>
                {data.todayAppts.map((a: any) => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 18px' }}>
                    <div style={{ textAlign:'center', flexShrink:0, width:'36px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--gray-900)' }}>{new Date(a.appointment_date).getHours()}h{String(new Date(a.appointment_date).getMinutes()).padStart(2,'0')}</div>
                    </div>
                    <div style={{ width:'3px', height:'32px', borderRadius:'99px', background:a.treatment?.color ?? 'var(--blue)', flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--gray-900)' }}>{a.patient?.first_name} {a.patient?.last_name}</div>
                      <div style={{ fontSize:'11px', color:'var(--gray-500)' }}>{a.treatment?.name ?? a.type}</div>
                    </div>
                    <span className={`badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'cancelled' ? '' : 'badge-gray'}`}
                      style={a.status === 'cancelled' ? { background:'#FEF2F2', color:'#B91C1C' } : {}}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {/* Trend */}
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)', marginBottom:'12px' }}>Consultations — 7 derniers jours</div>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={data.trend} margin={{ top:0, right:0, bottom:0, left:-28 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize:10, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius:'8px', border:'1px solid var(--gray-200)', fontSize:'12px' }} />
                  <Area type="monotone" dataKey="v" stroke="var(--blue)" strokeWidth={2} fill="url(#g)" name="Consultations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pending WhatsApp actions */}
            <div className="card">
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)' }}>⚡ Actions à envoyer</div>
                <Link href="/dashboard/automations" style={{ fontSize:'12px', color:'var(--blue)', textDecoration:'none' }}>Voir tout →</Link>
              </div>
              {data.pendingExec.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:'var(--gray-400)' }}>✅ Tout est à jour !</div>
              ) : (
                <div style={{ padding:'4px 0' }}>
                  {data.pendingExec.map((e: any) => (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 16px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'7px', background: e.step?.type === 'whatsapp' ? '#F0FDF4' : '#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0 }}>
                        {e.step?.type === 'whatsapp' ? '💬' : '📧'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'12.5px', fontWeight:'500', color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.patient?.first_name} {e.patient?.last_name}</div>
                        <div style={{ fontSize:'11px', color:'var(--gray-500)' }}>{e.step?.template_name}</div>
                      </div>
                      {e.patient?.phone && e.step?.type === 'whatsapp' && (
                        <a href={`https://wa.me/${e.patient.phone.replace(/\D/g,'')}`} target="_blank"
                          style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', borderRadius:'6px', background:'#25D366', color:'white', fontSize:'11px', fontWeight:'600', textDecoration:'none', flexShrink:0 }}>
                          💬
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          {/* Recent patients */}
          <div className="card">
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)' }}>Derniers patients</div>
              <Link href="/dashboard/patients" style={{ fontSize:'12px', color:'var(--blue)', textDecoration:'none' }}>Voir tous →</Link>
            </div>
            <div style={{ padding:'4px 0' }}>
              {data.recentPatients.map((p: any) => (
                <Link key={p.id} href={`/dashboard/patients/${p.id}`} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 18px', textDecoration:'none', transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="avatar" style={{ width:'32px', height:'32px', fontSize:'11px' }}>{p.first_name[0]}{p.last_name[0]}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--gray-900)' }}>{p.first_name} {p.last_name}</div>
                    <div style={{ fontSize:'11px', color:'var(--gray-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.email || p.phone || '—'}</div>
                  </div>
                  <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize:10, fontWeight:700, color: p.loyaltyScore >= 60 ? '#059669' : p.loyaltyScore >= 30 ? '#D97706' : '#94A3B8', background: p.loyaltyScore >= 60 ? '#F0FDF4' : p.loyaltyScore >= 30 ? '#FFFBEB' : 'var(--gray-100)', padding:'1px 7px', borderRadius:99 }}>
                      {p.loyaltyScore ?? 0}pts
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--gray-400)' }}>{formatDate(p.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Active journeys */}
          <div className="card">
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'13.5px', fontWeight:'600', color:'var(--gray-900)' }}>Parcours actifs</div>
              <Link href="/dashboard/patients" style={{ fontSize:'12px', color:'var(--blue)', textDecoration:'none' }}>Voir tous →</Link>
            </div>
            {data.activeJourneys.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', fontSize:'13px', color:'var(--gray-400)' }}>Aucun parcours actif</div>
            ) : (
              <div style={{ padding:'4px 0' }}>
                {data.activeJourneys.map((j: any) => {
                  const STAGE_LABELS: Record<string,string> = { lead:'Lead', consultation:'Consultation', devis_envoye:'Devis envoyé', devis_accepte:'Devis accepté', pre_op:'Pré-op', intervention:'Intervention', post_op_j1:'Post-op J+1', post_op_j7:'Post-op J+7', post_op_j30:'Post-op J+30', termine:'Terminé' }
                  return (
                    <Link key={j.id} href={`/dashboard/patients/${j.patient_id}`} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 18px', textDecoration:'none', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:j.treatment?.color ?? 'var(--blue)', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--gray-900)' }}>{j.patient?.first_name} {j.patient?.last_name}</div>
                        <div style={{ fontSize:'11px', color:'var(--gray-500)' }}>{j.treatment?.name}</div>
                      </div>
                      <div style={{ flexShrink:0 }}>
                        <div style={{ fontSize:'11px', fontWeight:'500', color:'var(--blue)', background:'var(--blue-light)', padding:'2px 8px', borderRadius:'99px' }}>{STAGE_LABELS[j.stage] ?? j.stage}</div>
                      </div>
                    </Link>
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
