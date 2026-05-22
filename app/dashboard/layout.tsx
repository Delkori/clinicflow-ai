'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile, Clinic } from '@/lib/types'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/dashboard/patients', label: 'Patients', icon: '👥' },
  { href: '/dashboard/consultations', label: 'Consultations', icon: '🩺' },
  { href: '/dashboard/appointments', label: 'Agenda', icon: '📅' },
  { href: '/dashboard/workflows', label: 'Workflows', icon: '⚙️' },
  { href: '/dashboard/automations', label: 'Automatisations', icon: '🤖' },
  { href: '/dashboard/settings', label: 'Paramètres', icon: '🔧' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profileData) {
        setProfile(profileData)
        const { data: clinicData } = await supabase.from('clinics').select('*').eq('id', profileData.clinic_id).single()
        if (clinicData) setClinic(clinicData)
      }
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-slate-900 text-white transition-all duration-200 flex-shrink-0',
        sidebarOpen ? 'w-64' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">CF</span>
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-bold text-sm text-white truncate">ClinicFlow AI</div>
              <div className="text-xs text-slate-400 truncate">{clinic?.name}</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto text-slate-400 hover:text-white flex-shrink-0">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-700 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-7 h-7 bg-violet-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white truncate">{profile?.full_name}</div>
                <div className="text-xs text-slate-400 capitalize">{profile?.role}</div>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 text-xs flex-shrink-0" title="Déconnexion">⏏</button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
