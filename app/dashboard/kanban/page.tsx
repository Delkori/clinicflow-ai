'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const COLS = [
  { id:'lead',         label:'Lead',               emoji:'🌱', color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
  { id:'consultation', label:'Consultation',        emoji:'🩺', color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
  { id:'devis',        label:'Devis envoyé',        emoji:'📋', color:'#B45309', bg:'#FFFBEB', border:'#FDE68A' },
  { id:'consent',      label:'Consentement',        emoji:'✍️', color:'#6D28D9', bg:'#FAF5FF', border:'#DDD6FE' },
  { id:'rdv',          label:'RDV programmé',       emoji:'📅', color:'#0E7490', bg:'#ECFEFF', border:'#A5F3FC' },
  { id:'postop',       label:'Post-op',             emoji:'💊', color:'#065F46', bg:'#ECFDF5', border:'#A7F3D0' },
]

function getStage(p: any): string {
  if (p.kanban_stage) return p.kanban_stage
  if (p.appointments?.length) return 'rdv'
  if (p.consultations?.length) return 'consultation'
  return 'lead'
}

export default function KanbanPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [dragging, setDragging] = useState<string|null>(null)
  const [over, setOver]         = useState<string|null>(null)

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase.from('profiles').select('clinic_id').single()
      if (!prof) return
      const { data } = await supabase.from('patients')
        .select('id,first_name,last_name,phone,email,created_at,kanban_stage,consultations(id),appointments(id)')
        .eq('clinic_id', prof.clinic_id).order('created_at', { ascending: false })
      setPatients((data ?? []).map(p => ({ ...p, _stage: getStage(p) })))
      setLoading(false)
    }
    load()
  }, [])

  async function move(pid: string, stage: string) {
    setPatients(prev => prev.map(p => p.id === pid ? { ...p, _stage: stage } : p))
    await supabase.from('patients').update({ kanban_stage: stage }).eq('id', pid)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Kanban — Parcours patient</div>
          <div className="page-subtitle">Glissez les cartes pour changer l&apos;étape du parcours</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/patients" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>📋 Vue liste</Link>
          <Link href="/dashboard/patients" className="btn-primary"   style={{ textDecoration:'none', fontSize:13 }}>+ Patient</Link>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex:1, overflow:'auto', padding:'24px 32px' }}>
        <div style={{ display:'flex', gap:14, minWidth:'max-content', height:'100%', alignItems:'flex-start' }}>
          {COLS.map(col => {
            const cards   = patients.filter(p => p._stage === col.id)
            const isOver  = over === col.id
            return (
              <div key={col.id} style={{ width:230, display:'flex', flexDirection:'column', flexShrink:0 }}
                onDragOver={e => { e.preventDefault(); setOver(col.id) }}
                onDragLeave={() => setOver(null)}
                onDrop={e => { e.preventDefault(); if (dragging) move(dragging, col.id); setDragging(null); setOver(null) }}>

                {/* Column header */}
                <div style={{ background:col.bg, border:`1px solid ${col.border}`, borderRadius:10, padding:'9px 12px', marginBottom:10, display:'flex', alignItems:'center', gap:8, transform: isOver ? 'scale(1.01)' : 'none', transition:'transform .15s' }}>
                  <span style={{ fontSize:15 }}>{col.emoji}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:col.color, flex:1 }}>{col.label}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:col.color, background:'rgba(255,255,255,.7)', borderRadius:99, padding:'1px 7px' }}>{cards.length}</span>
                </div>

                {/* Drop zone */}
                <div style={{ flex:1, minHeight:120, borderRadius:10, padding:4, border: isOver ? `2px dashed ${col.color}` : '2px solid transparent', background: isOver ? col.bg : 'transparent', transition:'all .15s', display:'flex', flexDirection:'column', gap:8 }}>
                  {cards.map(p => (
                    <div key={p.id} draggable
                      onDragStart={e => { setDragging(p.id); e.dataTransfer.effectAllowed='move' }}
                      onDragEnd={() => { setDragging(null); setOver(null) }}
                      style={{ background:'white', border:'1px solid var(--gray-200)', borderRadius:10, padding:'12px 13px', cursor:'grab', transition:'all .15s', opacity: dragging===p.id ? .3 : 1, transform: dragging===p.id ? 'scale(.97)' : 'none', userSelect:'none', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}
                      onMouseEnter={e => { if (dragging!==p.id) { e.currentTarget.style.borderColor='var(--blue-mid)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(5,150,222,.12)' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.04)' }}>

                      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                        <div className="avatar" style={{ width:30, height:30, fontSize:11, fontWeight:700, flexShrink:0 }}>
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.first_name} {p.last_name}</div>
                          <div style={{ fontSize:11, color:'var(--gray-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.phone || p.email || '—'}</div>
                        </div>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          {(p.consultations?.length ?? 0) > 0 && <span style={{ fontSize:11, fontWeight:500, background:'#EFF6FF', color:'#1D4ED8', padding:'2px 6px', borderRadius:5 }}>🩺 {p.consultations.length}</span>}
                          {(p.appointments?.length ?? 0) > 0 && <span style={{ fontSize:11, fontWeight:500, background:'#ECFDF5', color:'#065F46', padding:'2px 6px', borderRadius:5 }}>📅 {p.appointments.length}</span>}
                        </div>
                        <Link href={`/dashboard/patients/${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize:11, color:'var(--blue)', textDecoration:'none', fontWeight:500 }}>Voir →</Link>
                      </div>
                    </div>
                  ))}

                  {cards.length === 0 && !isOver && (
                    <div style={{ textAlign:'center', padding:'24px 0', fontSize:12, color:'var(--gray-300)' }}>Déposez ici</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
