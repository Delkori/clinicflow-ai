'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timingLabel, STEP_TYPE_LABELS, STEP_TYPE_COLORS, cn } from '@/lib/utils'
import type { Workflow, WorkflowStep, Treatment } from '@/lib/types'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNewWorkflow, setShowNewWorkflow] = useState(false)
  const [showNewStep, setShowNewStep] = useState(false)
  const [clinicId, setClinicId] = useState('')
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!profile) return
    setClinicId(profile.clinic_id)
    const [{ data: wfs }, { data: trts }] = await Promise.all([
      supabase.from('workflows').select('*, treatment:treatments(name, color), steps:workflow_steps(*)').eq('clinic_id', profile.clinic_id).order('created_at'),
      supabase.from('treatments').select('*').eq('clinic_id', profile.clinic_id),
    ])
    const sorted = (wfs ?? []).map((w: any) => ({
      ...w,
      steps: (w.steps ?? []).sort((a: WorkflowStep, b: WorkflowStep) => a.step_order - b.step_order)
    }))
    setWorkflows(sorted)
    setTreatments(trts ?? [])
    if (sorted.length > 0 && !selectedWorkflow) setSelectedWorkflow(sorted[0])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteStep(stepId: string) {
    await supabase.from('workflow_steps').delete().eq('id', stepId)
    load().then(() => {
      setSelectedWorkflow((prev: any) => workflows.find(w => w.id === prev?.id))
    })
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="flex h-full">
      {/* Left: workflows list */}
      <div className="w-72 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Workflows</h2>
          <button onClick={() => setShowNewWorkflow(true)}
            className="text-violet-600 hover:text-violet-800 text-xl font-bold">+</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm px-4">
              Aucun workflow. Créez-en un pour démarrer.
            </div>
          ) : workflows.map(w => (
            <button key={w.id} onClick={() => setSelectedWorkflow(w)}
              className={cn(
                'w-full text-left px-3 py-3 rounded-lg transition-colors',
                selectedWorkflow?.id === w.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'
              )}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: w.treatment?.color ?? '#8b5cf6' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{w.name}</p>
                  <p className="text-xs text-gray-500 truncate">{w.treatment?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-400">{w.steps?.length ?? 0} étape{w.steps?.length !== 1 ? 's' : ''}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {w.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: workflow detail / builder */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedWorkflow ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-5xl mb-4">⚙️</p>
              <p className="text-lg font-medium">Sélectionnez un workflow</p>
              <p className="text-sm mt-1">ou créez-en un nouveau</p>
              <button onClick={() => setShowNewWorkflow(true)}
                className="mt-4 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
                + Créer un workflow
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{selectedWorkflow.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Traitement : {selectedWorkflow.treatment?.name}</p>
              </div>
              <button onClick={() => setShowNewStep(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                + Ajouter une étape
              </button>
            </div>

            {/* Steps */}
            {selectedWorkflow.steps?.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium">Aucune étape</p>
                <p className="text-sm mt-1">Ajoutez des étapes pour automatiser le parcours patient</p>
                <button onClick={() => setShowNewStep(true)}
                  className="mt-4 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors">
                  + Ajouter la première étape
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {selectedWorkflow.steps.map((step: WorkflowStep, i: number) => (
                    <div key={step.id} className="relative flex gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold z-10 flex-shrink-0 ${
                        step.type === 'email' ? 'bg-blue-100 text-blue-700' :
                        step.type === 'whatsapp' ? 'bg-green-100 text-green-700' :
                        step.type === 'docusign' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {step.type === 'email' ? '📧' : step.type === 'whatsapp' ? '💬' : step.type === 'docusign' ? '✍️' : '📄'}
                      </div>
                      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_COLORS[step.type]}`}>
                                {STEP_TYPE_LABELS[step.type]}
                              </span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {timingLabel(step.timing_days, step.timing_reference)}
                              </span>
                              {!step.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactif</span>}
                            </div>
                            <p className="font-medium text-gray-900 mt-2">{step.template_name ?? 'Sans nom'}</p>
                            {step.template_subject && <p className="text-xs text-gray-500 mt-0.5">Sujet : {step.template_subject}</p>}
                            {step.template_body && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{step.template_body}</p>
                            )}
                          </div>
                          <button onClick={() => deleteStep(step.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0">🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Workflow Modal */}
      {showNewWorkflow && (
        <NewWorkflowModal
          treatments={treatments}
          clinicId={clinicId}
          onClose={() => setShowNewWorkflow(false)}
          onCreated={() => { setShowNewWorkflow(false); load() }}
        />
      )}

      {/* New Step Modal */}
      {showNewStep && selectedWorkflow && (
        <NewStepModal
          workflowId={selectedWorkflow.id}
          stepCount={selectedWorkflow.steps?.length ?? 0}
          onClose={() => setShowNewStep(false)}
          onCreated={() => { setShowNewStep(false); load() }}
        />
      )}
    </div>
  )
}

function NewWorkflowModal({ treatments, clinicId, onClose, onCreated }: {
  treatments: Treatment[], clinicId: string, onClose: () => void, onCreated: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', treatment_id: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('workflows').insert({ ...form, clinic_id: clinicId })
    setLoading(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Nouveau workflow</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom du workflow *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Parcours greffe complet..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Traitement associé *</label>
            <select value={form.treatment_id} onChange={e => setForm(f => ({ ...f, treatment_id: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Choisir un traitement...</option>
              {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewStepModal({ workflowId, stepCount, onClose, onCreated }: {
  workflowId: string, stepCount: number, onClose: () => void, onCreated: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    type: 'email',
    timing_days: 0,
    timing_reference: 'consultation',
    template_name: '',
    template_subject: '',
    template_body: '',
  })
  const [loading, setLoading] = useState(false)
  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: k === 'timing_days' ? parseInt(e.target.value) || 0 : e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('workflow_steps').insert({ ...form, workflow_id: workflowId, step_order: stepCount + 1 })
    setLoading(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Nouvelle étape</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type d&apos;action *</label>
              <select value={form.type} onChange={update('type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="email">📧 Email</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="document">📄 Document</option>
                <option value="docusign">✍️ DocuSign</option>
                <option value="sms">📱 SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Référence timing</label>
              <select value={form.timing_reference} onChange={update('timing_reference')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="consultation">Consultation</option>
                <option value="intervention">Intervention</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Timing (jours) — négatif = avant</label>
            <input type="number" value={form.timing_days} onChange={update('timing_days')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <p className="text-xs text-gray-400 mt-0.5">
              {form.timing_days === 0 ? 'Le jour même' : form.timing_days > 0 ? `J+${form.timing_days}` : `J${form.timing_days}`} après {form.timing_reference === 'consultation' ? 'la consultation' : "l'intervention"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom du template *</label>
            <input type="text" value={form.template_name} onChange={update('template_name')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="rappel_consultation, instructions_post_op..." />
          </div>
          {form.type === 'email' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sujet email</label>
              <input type="text" value={form.template_subject} onChange={update('template_subject')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Corps du message</label>
            <textarea value={form.template_body} onChange={update('template_body')} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder="Utilisez {{patient_name}} pour le nom du patient..." />
            <p className="text-xs text-gray-400 mt-0.5">Variables : {`{{patient_name}}`}, {`{{clinic_name}}`}, {`{{appointment_date}}`}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
              {loading ? 'Ajout...' : 'Ajouter l\'étape'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
