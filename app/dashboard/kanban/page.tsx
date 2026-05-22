'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const COLUMNS = [
  { id: 'lead',         label: 'Nouveau lead',        emoji: '🌱', color: 'bg-gray-100 border-gray-200',       dot: 'bg-gray-400' },
  { id: 'consultation', label: 'En consultation',      emoji: '🩺', color: 'bg-blue-50 border-blue-200',        dot: 'bg-blue-400' },
  { id: 'devis',        label: 'Devis envoyé',         emoji: '📋', color: 'bg-amber-50 border-amber-200',      dot: 'bg-amber-400' },
  { id: 'consent',      label: 'Consentement signé',   emoji: '✍️', color: 'bg-violet-50 border-violet-200',    dot: 'bg-violet-400' },
  { id: 'rdv',          label: 'RDV programmé',        emoji: '📅', color: 'bg-cyan-50 border-cyan-200',        dot: 'bg-cyan-400' },
  { id: 'postop',       label: 'Suivi post-op',        emoji: '💊', color: 'bg-green-50 border-green-200',      dot: 'bg-green-400' },
]

function getInitialStage(p: any): string {
  if (p.kanban_stage) return p.kanban_stage
  if (p.appointments?.length > 0) return 'rdv'
  if (p.consultations?.length > 0) return 'consultation'
  return 'lead'
}

export default function KanbanPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase.from('profiles').select('clinic_id').single()
      if (!prof) return
      const { data } = await supabase
        .from('patients')
        .select('id,first_name,last_name,phone,email,created_at,kanban_stage,consultations(id),appointments(id)')
        .eq('clinic_id', prof.clinic_id)
        .order('created_at', { ascending: false })
      setPatients((data ?? []).map(p => ({ ...p, _stage: getInitialStage(p) })))
      setLoading(false)
    }
    load()
  }, [supabase])

  async function movePatient(patientId: string, newStage: string) {
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, _stage: newStage } : p))
    await supabase.from('patients').update({ kanban_stage: newStage }).eq('id', patientId)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="p-6 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Kanban — Parcours patient</h1>
          <p className="text-sm text-gray-400 mt-0.5">Glissez les cartes pour changer l'étape du parcours</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/patients" className="btn-secondary text-sm">📋 Vue liste</Link>
          <Link href="/dashboard/patients/new" className="btn-primary text-sm">+ Patient</Link>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-4">
        {COLUMNS.map(col => {
          const colPatients = patients.filter(p => p._stage === col.id)
          const isOver = dragOver === col.id
          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-64 flex flex-col"
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                e.preventDefault()
                if (dragging) movePatient(dragging, col.id)
                setDragging(null); setDragOver(null)
              }}
            >
              {/* Column header */}
              <div className={`rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 border ${col.color} transition-all ${isOver ? 'scale-[1.02] shadow-sm' : ''}`}>
                <span>{col.emoji}</span>
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="ml-auto text-xs font-medium text-gray-500 bg-white bg-opacity-70 rounded-full px-2 py-0.5">{colPatients.length}</span>
              </div>

              {/* Drop zone */}
              <div className={`flex-1 space-y-2.5 rounded-xl min-h-[120px] transition-all p-1 ${isOver ? 'bg-blue-50 border-2 border-dashed border-[var(--blue)]' : ''}`}>
                {colPatients.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={e => { setDragging(p.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    className={`bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-[var(--blue-mid)] hover:shadow-md transition-all select-none ${dragging === p.id ? 'opacity-30 scale-95' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">{p.phone || p.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {p.consultations?.length > 0 && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">🩺 {p.consultations.length}</span>
                        )}
                        {p.appointments?.length > 0 && (
                          <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md font-medium">📅 {p.appointments.length}</span>
                        )}
                      </div>
                      <Link href={`/dashboard/patients/${p.id}`} onClick={e => e.stopPropagation()} className="text-xs text-[var(--blue)] hover:underline font-medium">Voir →</Link>
                    </div>
                  </div>
                ))}
                {colPatients.length === 0 && !isOver && (
                  <div className="text-center py-6 text-gray-300 text-xs">Déposez ici</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
