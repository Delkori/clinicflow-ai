'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',                  label: 'Tableau de bord', icon: '▦', exact: true },
  { href: '/dashboard/patients',         label: 'Patients',        icon: '◎' },
  { href: '/dashboard/kanban',           label: 'Kanban',          icon: '▣' },
  { href: '/dashboard/consultations',    label: 'Consultations',   icon: '✦' },
  { href: '/dashboard/appointments',     label: 'Agenda',          icon: '◫' },
  { href: '/dashboard/workflows',        label: 'Workflows',       icon: '⬡' },
  { href: '/dashboard/automations',      label: 'Automatisations', icon: '⚡' },
  { href: '/dashboard/analytics',        label: 'Analytiques',     icon: '📊' },
  { href: '/dashboard/import',           label: 'Import Doctolib', icon: '📥' },
  { href: '/dashboard/settings',         label: 'Paramètres',      icon: '⚙️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (!data) return
        setProfile(data)
        supabase.from('clinics').select('*').eq('id', data.clinic_id).single().then(({ data: c }) => setClinic(c))
      })
    })
  }, [])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--gray-50)' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
        background: 'var(--gray-900)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '64px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--blue)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '14px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>ClinicFlow AI</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic?.name}</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px', flexShrink: 0, marginLeft: collapsed ? 0 : 'auto' }}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '8px',
                fontSize: '13.5px', fontWeight: active ? '600' : '400',
                color: active ? 'white' : 'rgba(255,255,255,0.45)',
                background: active ? 'rgba(5,150,222,0.25)' : 'transparent',
                transition: 'all 0.12s', textDecoration: 'none',
                whiteSpace: 'nowrap', overflow: 'hidden',
                border: active ? '1px solid rgba(5,150,222,0.3)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = active ? 'white' : 'rgba(255,255,255,0.75)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'white' : 'rgba(255,255,255,0.45)' }}
              >
                <span style={{ fontSize: '15px', flexShrink: 0, width: '20px', textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Settings + User */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px' }}>
          <Link href="/dashboard/settings" style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 10px', borderRadius: '8px',
            color: pathname === '/dashboard/settings' ? 'white' : 'rgba(255,255,255,0.45)',
            fontSize: '13.5px', textDecoration: 'none',
            background: pathname === '/dashboard/settings' ? 'rgba(5,150,222,0.25)' : 'transparent',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '15px', flexShrink: 0, width: '20px', textAlign: 'center' }}>⚙</span>
            {!collapsed && <span>Paramètres</span>}
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', textTransform: 'capitalize' }}>{profile?.role}</div>
              </div>
            )}
            {!collapsed && (
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '2px', flexShrink: 0 }}
                title="Déconnexion">⏏</button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
