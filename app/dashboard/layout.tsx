'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_MAIN = [
  { href:'/dashboard',               label:'Accueil',        icon:'▦', exact:true },
  { href:'/dashboard/patients',      label:'Patients',       icon:'◎' },
  { href:'/dashboard/consultations', label:'Consultations',  icon:'✦' },
  { href:'/dashboard/agenda',        label:'Agenda',         icon:'◫' },
  { href:'/dashboard/documents',     label:'Documents',      icon:'📄' },
  { href:'/dashboard/booking',       label:'RDV en ligne',   icon:'🔗' },
]
const NAV_TOOLS = [
  { href:'/dashboard/flows',         label:'Workflows',      icon:'⚡' },
  { href:'/dashboard/flows/runs',      label:'Exécutions',     icon:'📋' },
  { href:'/dashboard/automations',   label:'Logs auto.',     icon:'📋' },
  { href:'/dashboard/integrations',  label:'Intégrations',   icon:'🔌' },
  { href:'/dashboard/team',          label:'Équipe',         icon:'👥' },
  { href:'/dashboard/analytics',     label:'Analytiques',    icon:'▲' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [profile, setProfile]     = useState<any>(null)
  const [clinic,  setClinic]      = useState<any>(null)
  const [col, setCol]             = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs]   = useState(false)
  const [notifs, setNotifs]           = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{user} }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (!data) return
        setProfile(data)
        supabase.from('clinics').select('*').eq('id', data.clinic_id).single().then(({ data:c }) => {
          setClinic(c)
          if (c) {
            supabase.from('notifications').select('*', { count:'exact', head:true }).eq('clinic_id', c.id).eq('is_read', false).then(({ count }) => setUnreadCount(count ?? 0))
          }
        })
      })
    })
  }, [])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const NavLink = ({ href, label, icon, exact }: { href:string;label:string;icon:string;exact?:boolean }) => {
    const active = isActive(href, exact)
    return (
      <Link href={href} style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'8px 10px', borderRadius:8,
        fontSize:13, fontWeight: active ? 600 : 400,
        color: active ? 'white' : 'rgba(255,255,255,0.45)',
        background: active ? 'rgba(5,150,222,0.3)' : 'transparent',
        border: active ? '1px solid rgba(5,150,222,0.35)' : '1px solid transparent',
        textDecoration:'none', whiteSpace:'nowrap', overflow:'hidden',
        transition:'all 0.12s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.75)' }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.45)' }}}
      >
        <span style={{ fontSize:14, flexShrink:0, width:18, textAlign:'center' }}>{icon}</span>
        {!col && <span>{label}</span>}
      </Link>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--gray-50)' }}>
      <aside style={{ width: col ? '56px' : '220px', background:'var(--gray-900)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 0.18s ease', overflow:'hidden' }}>
        {/* Logo */}
        <div style={{ padding:'16px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10, minHeight:60 }}>
          <div style={{ width:30, height:30, background:'var(--blue)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {!col && (
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ color:'white', fontWeight:700, fontSize:13.5, letterSpacing:'-0.2px', whiteSpace:'nowrap' }}>ClinicFlow AI</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:10.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{clinic?.name}</div>
            </div>
          )}
          <button onClick={() => setCol(!col)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:11, padding:4, flexShrink:0, marginLeft: col ? 0 : 'auto' }}>
            {col ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
          {!col && <div style={{ fontSize:9.5, fontWeight:700, color:'rgba(255,255,255,0.2)', letterSpacing:'0.08em', textTransform:'uppercase', padding:'8px 10px 4px' }}>Quotidien</div>}
          {NAV_MAIN.map(item => <NavLink key={item.href} {...item} />)}

          {!col && <div style={{ fontSize:9.5, fontWeight:700, color:'rgba(255,255,255,0.2)', letterSpacing:'0.08em', textTransform:'uppercase', padding:'14px 10px 4px' }}>Outils</div>}
          {col && <div style={{ height:12 }} />}
          {NAV_TOOLS.map(item => <NavLink key={item.href} {...item} />)}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:8 }}>
          <NavLink href="/dashboard/onboarding" label="Démarrage" icon="🚀" />
          <NavLink href="/dashboard/settings" label="Paramètres" icon="⚙" />
          <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', marginTop:4 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white', flexShrink:0 }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {!col && (
              <>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.full_name}</div>
                  <div style={{ color:'rgba(255,255,255,0.3)', fontSize:10, textTransform:'capitalize' }}>{profile?.role}</div>
                </div>
                <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
                  title="Déconnexion" style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:13, padding:2, flexShrink:0 }}>⏏</button>
              </>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' }}>
        {/* Notification bell */}
        <div style={{ position:'absolute', top:16, right:24, zIndex:20 }}>
          <button onClick={() => {
            setShowNotifs(!showNotifs)
            if (!showNotifs && clinic?.id) {
              supabase.from('notifications').select('*, patient:patients(first_name, last_name)').eq('clinic_id', clinic.id).order('created_at', { ascending:false }).limit(15).then(({ data }) => setNotifs(data ?? []))
            }
          }} style={{ position:'relative', width:34, height:34, borderRadius:9, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
            🔔
            {unreadCount > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:17, height:17, borderRadius:'50%', background:'#EF4444', color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {showNotifs && (
            <div style={{ position:'absolute', top:42, right:0, width:320, background:'white', borderRadius:12, border:'1px solid var(--gray-200)', boxShadow:'0 8px 32px rgba(0,0,0,.12)', overflow:'hidden', zIndex:100 }}>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>Notifications {unreadCount > 0 && <span style={{ fontSize:11, background:'#EF4444', color:'white', borderRadius:99, padding:'1px 7px', marginLeft:4 }}>{unreadCount}</span>}</div>
                {unreadCount > 0 && <button onClick={async () => { if (clinic?.id) { await supabase.from('notifications').update({ is_read: true }).eq('clinic_id', clinic.id).eq('is_read', false); setUnreadCount(0); setNotifs(n => n.map(x => ({ ...x, is_read: true }))) } }} style={{ fontSize:11, color:'var(--blue)', background:'none', border:'none', cursor:'pointer' }}>Tout marquer lu</button>}
              </div>
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding:24, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
                    Aucune notification
                  </div>
                ) : notifs.map(n => (
                  <div key={n.id} onClick={async () => { if (!n.is_read) { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); setUnreadCount(c => Math.max(0, c-1)); setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)) }; if (n.link) window.location.href = n.link; else setShowNotifs(false) }}
                    style={{ padding:'10px 14px', borderBottom:'1px solid var(--gray-50)', cursor:'pointer', background: n.is_read ? 'white' : 'var(--blue-light)', display:'flex', gap:10, alignItems:'flex-start', transition:'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = n.is_read ? 'var(--gray-50)' : '#DBEAFE'}
                    onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'white' : 'var(--blue-light)'}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{n.type === 'booking_request'?'📅':n.type === 'document_unsigned'?'✍️':n.type === 'workflow_failed'?'❌':'🔔'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight: n.is_read ? 400 : 600, color:'var(--gray-900)', marginBottom:2 }}>{n.title}</div>
                      {n.message && <div style={{ fontSize:11, color:'var(--gray-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.message}</div>}
                    </div>
                    {!n.is_read && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--blue)', flexShrink:0, marginTop:5 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
