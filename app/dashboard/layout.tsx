'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href:'/dashboard',                label:'Tableau de bord', icon:'▦', exact:true },
  { href:'/dashboard/patients',       label:'Patients',        icon:'◎' },
  { href:'/dashboard/kanban',         label:'Kanban',          icon:'▣' },
  { href:'/dashboard/consultations',  label:'Consultations',   icon:'✦' },
  { href:'/dashboard/appointments',   label:'Agenda',          icon:'◫' },
  { href:'/dashboard/workflows',      label:'Workflows',       icon:'⬡' },
  { href:'/dashboard/automations',    label:'Automatisations', icon:'⚡' },
  { href:'/dashboard/analytics',      label:'Analytiques',     icon:'▲' },
  { href:'/dashboard/import',         label:'Import Doctolib', icon:'▼' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [clinic,  setClinic]  = useState<any>(null)
  const [col, setCol]         = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{user} }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (!data) return
        setProfile(data)
        supabase.from('clinics').select('*').eq('id', data.clinic_id).single().then(({ data:c }) => setClinic(c))
      })
    })
  }, [])

  const isActive = (href:string, exact?:boolean) => exact ? pathname===href : pathname===href || pathname.startsWith(href+'/')

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--gray-50)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Sidebar */}
      <aside style={{ width: col ? 64 : 240, background:'var(--gray-900)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width .2s ease', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ padding:'18px 14px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:10, minHeight:62 }}>
          <div style={{ width:32, height:32, background:'var(--blue)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!col && (
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ color:'white', fontWeight:700, fontSize:14, letterSpacing:'-0.2px', whiteSpace:'nowrap' }}>ClinicFlow AI</div>
              <div style={{ color:'rgba(255,255,255,.35)', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{clinic?.name}</div>
            </div>
          )}
          <button onClick={() => setCol(!col)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.25)', fontSize:11, padding:'3px', flexShrink:0, marginLeft: col ? 0 : 'auto' }}>
            {col ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
          {NAV.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link key={item.href} href={item.href} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:8, textDecoration:'none',
                fontSize:13.5, fontWeight: active ? 600 : 400,
                color: active ? 'white' : 'rgba(255,255,255,.4)',
                background: active ? 'rgba(5,150,222,.22)' : 'transparent',
                border: active ? '1px solid rgba(5,150,222,.28)' : '1px solid transparent',
                transition:'all .1s', whiteSpace:'nowrap', overflow:'hidden',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.color='rgba(255,255,255,.7)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,.4)' }}}>
                <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:'center', opacity: active ? 1 : .65 }}>{item.icon}</span>
                {!col && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: settings + user */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,.07)', padding:'10px 8px' }}>
          <Link href="/dashboard/settings" style={{
            display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, textDecoration:'none',
            fontSize:13.5, color: pathname==='/dashboard/settings' ? 'white' : 'rgba(255,255,255,.4)',
            background: pathname==='/dashboard/settings' ? 'rgba(5,150,222,.22)' : 'transparent',
            marginBottom:6, whiteSpace:'nowrap', overflow:'hidden',
          }}>
            <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:'center' }}>⚙</span>
            {!col && <span>Paramètres</span>}
          </Link>

          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {!col && <>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ color:'rgba(255,255,255,.8)', fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.full_name}</div>
                <div style={{ color:'rgba(255,255,255,.3)', fontSize:11, textTransform:'capitalize' }}>{profile?.role}</div>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.25)', fontSize:13, padding:'2px', flexShrink:0 }}
                onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
                onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.25)'}>⏏</button>
            </>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  )
}
