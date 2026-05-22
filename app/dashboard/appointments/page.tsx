'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-600',
}

const TYPE_ICONS: Record<string, string> = {
  consultation: '🩺',
  intervention: '⚕️',
  suivi: '🔄',
  control: '✅',
}

export default function AppointmentsPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profile } = await supabase.from('profiles').select('clinic_id').single()
      if (!profile) return
      const { data } = await supabase
        .from('appointments')
        .select('*, patient:patients(*), treatment:treatments(*)')
        .eq('clinic_id', profile.clinic_id)
        .order('appointment_date', { ascending: true })
      setAppointments(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const today = new Date().toDateString()
  const todayAppts = appointments.filter(a => new Date(a.appointment_date).toDateString() === today)
  const upcoming = appointments.filter(a => new Date(a.appointment_date) > new Date() && new Date(a.appointment_date).toDateString() !== today)

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" /></div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">{appointments.length} rendez-vous au total</p>
        </div>
      </div>

      {todayAppts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Aujourd'hui — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="space-y-3">
            {todayAppts.map(a => (
              <div key={a.id} className="bg-white border border-[var(--blue-mid)] rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--blue-light)] flex items-center justify-center text-xl flex-shrink-0">
                  {TYPE_ICONS[a.type] ?? '📅'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {a.patient ? <Link href={`/dashboard/patients/${a.patient.id}`} className="hover:text-[var(--blue)]">{a.patient.first_name} {a.patient.last_name}</Link> : 'Patient inconnu'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{a.treatment?.name ?? 'Sans traitement'} · {formatDateTime(a.appointment_date)}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">À venir</h2>
        {upcoming.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">Aucun rendez-vous à venir</div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(a => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-[var(--blue-mid)] transition-colors">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                  {TYPE_ICONS[a.type] ?? '📅'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {a.patient ? <Link href={`/dashboard/patients/${a.patient.id}`} className="hover:text-[var(--blue)]">{a.patient.first_name} {a.patient.last_name}</Link> : 'Patient inconnu'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{a.treatment?.name ?? 'Sans traitement'} · {formatDateTime(a.appointment_date)}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
