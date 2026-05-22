'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const PLAN_LABELS: Record<string, { label: string; color: string; badge: string }> = {
  free:   { label: 'Free',   color: 'bg-gray-100 text-gray-700',      badge: '🆓' },
  pro:    { label: 'Pro',    color: 'bg-blue-100 text-blue-700',       badge: '⚡' },
  clinic: { label: 'Clinic', color: 'bg-violet-100 text-violet-700',   badge: '🏥' },
}

const INTEGRATIONS_CONFIG = [
  { provider: 'twilio', label: 'Twilio — WhatsApp & SMS', icon: '💬', desc: 'Envoyez des messages WhatsApp réels à vos patients.', fields: [
    { key: 'account_sid',    label: 'Account SID',    placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
    { key: 'auth_token',     label: 'Auth Token',     placeholder: '••••••••••••••••••••••••••••••••',  type: 'password' },
    { key: 'whatsapp_from',  label: 'Numéro WhatsApp', placeholder: 'whatsapp:+14155238886',             type: 'text' },
  ]},
  { provider: 'openai', label: 'OpenAI — IA & Transcription', icon: '🤖', desc: 'Transcription audio (Whisper) et structuration GPT-4 des consultations.', fields: [
    { key: 'api_key', label: 'API Key',     placeholder: 'sk-...', type: 'password' },
    { key: 'model',   label: 'Modèle GPT', placeholder: 'gpt-4o', type: 'text' },
  ]},
  { provider: 'docusign', label: 'DocuSign — Signature électronique', icon: '✍️', desc: 'Envoi de consentements éclairés à signer en ligne.', fields: [
    { key: 'integration_key', label: 'Integration Key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
    { key: 'account_id',      label: 'Account ID',      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
    { key: 'access_token',    label: 'Access Token',    placeholder: '••••••••••••••••',                     type: 'password' },
  ]},
]

function IntegrationCard({ integ, savedConfig, onSave, saving }: any) {
  const [vals, setVals] = useState<Record<string,string>>(savedConfig ?? {})
  const isConfigured = !!savedConfig && Object.values(savedConfig).some(v => !!v)
  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <span className="text-3xl mt-0.5">{integ.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <p className="font-semibold text-gray-900">{integ.label}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isConfigured ? '✓ Configuré' : 'Non configuré'}
            </span>
          </div>
          <p className="text-sm text-gray-500">{integ.desc}</p>
        </div>
      </div>
      <div className="space-y-3 mb-5">
        {integ.fields.map((field: any) => (
          <div key={field.key}>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">{field.label}</label>
            <input
              type={field.type}
              placeholder={field.placeholder}
              value={vals[field.key] ?? ''}
              onChange={e => setVals(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="input w-full font-mono text-sm"
              autoComplete="off"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => onSave(integ.provider, vals)} disabled={saving === integ.provider} className="btn-primary">
          {saving === integ.provider ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const [clinic, setClinic] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [treatments, setTreatments] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [integrations, setIntegrations] = useState<Record<string, Record<string,string>>>({})
  const [tab, setTab] = useState<'clinic'|'integrations'|'team'|'billing'|'treatments'>('clinic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string|null>(null)
  const [clinicName, setClinicName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('assistant')
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) return
      setProfile(prof)
      const { data: cl } = await supabase.from('clinics').select('*').eq('id', prof.clinic_id).single()
      if (cl) { setClinic(cl); setClinicName(cl.name) }
      const [
        { data: trts },
        { data: mbs },
        { data: invs },
        { data: ints },
      ] = await Promise.all([
        supabase.from('treatments').select('*').eq('clinic_id', prof.clinic_id).order('created_at'),
        supabase.from('profiles').select('*').eq('clinic_id', prof.clinic_id),
        supabase.from('team_invitations').select('*').eq('clinic_id', prof.clinic_id).is('accepted_at', null),
        supabase.from('clinic_integrations').select('*').eq('clinic_id', prof.clinic_id),
      ])
      setTreatments(trts ?? [])
      setMembers(mbs ?? [])
      setInvitations(invs ?? [])
      const map: Record<string,Record<string,string>> = {}
      for (const i of ints ?? []) map[i.provider] = i.config
      setIntegrations(map)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function saveIntegration(provider: string, config: Record<string,string>) {
    setSaving(provider)
    await supabase.from('clinic_integrations').upsert(
      { clinic_id: clinic.id, provider, config, is_active: true },
      { onConflict: 'clinic_id,provider' }
    )
    setIntegrations(prev => ({ ...prev, [provider]: config }))
    setSaving(null)
    showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sauvegardé ✓`)
  }

  async function saveClinic() {
    setSaving('clinic')
    await supabase.from('clinics').update({ name: clinicName }).eq('id', clinic.id)
    setClinic((c: any) => ({ ...c, name: clinicName }))
    setSaving(null)
    showToast('Clinique mise à jour ✓')
  }

  async function sendInvite() {
    if (!inviteEmail || !clinic) return
    setSaving('invite')
    const { error } = await supabase.from('team_invitations').insert({
      clinic_id: clinic.id, email: inviteEmail, role: inviteRole, invited_by: profile.id,
    })
    setSaving(null)
    if (error) { showToast(error.message, false); return }
    showToast(`Invitation envoyée à ${inviteEmail} ✓`)
    setInviteEmail('')
    const { data } = await supabase.from('team_invitations').select('*').eq('clinic_id', clinic.id).is('accepted_at', null)
    setInvitations(data ?? [])
  }

  async function cancelInvite(id: string) {
    await supabase.from('team_invitations').delete().eq('id', id)
    setInvitations(prev => prev.filter(i => i.id !== id))
    showToast('Invitation annulée')
  }

  async function seedDefaults() {
    await supabase.rpc('seed_clinic_defaults', { p_clinic_id: clinic.id })
    const { data } = await supabase.from('treatments').select('*').eq('clinic_id', clinic.id)
    setTreatments(data ?? [])
    showToast('Traitements et workflows par défaut ajoutés ✓')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-[var(--blue)] border-t-transparent rounded-full" />
    </div>
  )

  const plan = PLAN_LABELS[clinic?.plan ?? 'free']
  const tabs = [
    { id: 'clinic',       label: '🏥 Clinique' },
    { id: 'integrations', label: '🔌 Intégrations' },
    { id: 'team',         label: `👥 Équipe (${members.length})` },
    { id: 'billing',      label: '💳 Abonnement' },
    { id: 'treatments',   label: `💉 Traitements (${treatments.length})` },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl transition-all ${toast.ok ? 'bg-[var(--green)] text-white' : 'bg-rose-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Paramètres</h1>
        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${plan.color}`}>{plan.badge} Plan {plan.label}</span>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-shrink-0 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── CLINIQUE ─── */}
      {tab === 'clinic' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Informations de la clinique</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom de la clinique</label>
            <input value={clinicName} onChange={e => setClinicName(e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
            <div>
              <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">ID Clinique</span>
              <span className="font-mono text-xs">{clinic?.id}</span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Créée le</span>
              {new Date(clinic?.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <button onClick={saveClinic} disabled={saving === 'clinic'} className="btn-primary">
            {saving === 'clinic' ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {/* ─── INTÉGRATIONS ─── */}
      {tab === 'integrations' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            💡 Vos clés API sont stockées de façon sécurisée dans la base de données de votre clinique uniquement.
          </div>
          {INTEGRATIONS_CONFIG.map(integ => (
            <IntegrationCard
              key={integ.provider}
              integ={integ}
              savedConfig={integrations[integ.provider]}
              onSave={saveIntegration}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* ─── ÉQUIPE ─── */}
      {tab === 'team' && (
        <div className="space-y-5">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Membres actuels</h2>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--blue-light)] text-[var(--blue)] flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {(m.full_name || m.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{m.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${m.role === 'medecin' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{m.role ?? 'membre'}</span>
                  {m.id === profile?.id && <span className="text-xs text-gray-400">vous</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Inviter un membre</h2>
            <div className="flex gap-3 flex-wrap">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@clinique.com" className="input flex-1 min-w-[180px]" type="email" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="input w-40">
                <option value="assistant">Assistant(e)</option>
                <option value="medecin">Médecin</option>
              </select>
              <button onClick={sendInvite} disabled={saving === 'invite' || !inviteEmail} className="btn-primary">
                {saving === 'invite' ? '...' : 'Inviter'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">L'invitation expirera dans 7 jours.</p>
          </div>
          {invitations.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Invitations en attente ({invitations.length})</h2>
              <div className="space-y-3">
                {invitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                      <p className="text-xs text-gray-400">Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">{inv.role}</span>
                      <button onClick={() => cancelInvite(inv.id)} className="text-xs text-rose-500 hover:text-rose-700">Annuler</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── BILLING ─── */}
      {tab === 'billing' && (
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">Plan actuel</h2>
                <p className="text-sm text-gray-500 mt-1">Gérez votre abonnement ClinicFlow AI</p>
              </div>
              <span className={`text-sm px-4 py-2 rounded-full font-semibold ${plan.color}`}>{plan.badge} {plan.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Patients inclus</p>
                <p className="text-3xl font-bold text-gray-900">{clinic?.patients_limit ?? 50}</p>
                <p className="text-xs text-gray-400 mt-1">maximum sur ce plan</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Automations / mois</p>
                <p className="text-3xl font-bold text-gray-900">{clinic?.automations_limit ?? 100}</p>
                <p className="text-xs text-gray-400 mt-1">maximum sur ce plan</p>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { plan: 'free',   name: 'Free',   price: '0€/mois',    features: ['50 patients', '100 automations/mois', 'Import Doctolib', 'WhatsApp simulation'] },
              { plan: 'pro',    name: 'Pro',     price: '49€/mois',   features: ['500 patients', '1 000 automations/mois', 'WhatsApp réel', 'Transcription IA', '3 membres équipe'], highlight: true },
              { plan: 'clinic', name: 'Clinic',  price: '149€/mois',  features: ['Patients illimités', 'Automations illimitées', 'Membres illimités', 'Support prioritaire', 'Onboarding dédié'] },
            ].map(p => (
              <div key={p.plan} className={`card p-5 ${(p as any).highlight ? 'border-[var(--blue)] border-2 relative' : ''}`}>
                {(p as any).highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white bg-[var(--blue)] px-3 py-1 rounded-full">⚡ Recommandé</div>}
                <p className="font-semibold text-gray-900 mt-2">{p.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 mb-4">{p.price}</p>
                <ul className="space-y-2 mb-5">
                  {p.features.map(f => (
                    <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="text-green-500 flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full ${clinic?.plan === p.plan ? 'btn-secondary opacity-60 cursor-default' : 'btn-primary'}`}
                  disabled={clinic?.plan === p.plan}
                >
                  {clinic?.plan === p.plan ? 'Plan actuel' : 'Choisir ce plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TRAITEMENTS ─── */}
      {tab === 'treatments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{treatments.length} traitement(s)</p>
            <button onClick={seedDefaults} className="btn-secondary text-sm">⚡ Charger les défauts</button>
          </div>
          {treatments.map(t => (
            <div key={t.id} className="card p-4 flex items-center gap-4">
              <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: t.color || 'var(--blue)' }} />
              <div>
                <p className="font-medium text-gray-900">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
              </div>
            </div>
          ))}
          {treatments.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">💉</p>
              <p className="text-sm">Aucun traitement. Cliquez sur "Charger les défauts" pour commencer.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
