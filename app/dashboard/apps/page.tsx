'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────
// CATALOGUE DES APPLICATIONS
// ─────────────────────────────────────────────────────────────────
const APP_CATEGORIES = [
  { id: 'all',          label: 'Toutes',          icon: '⚡' },
  { id: 'communication',label: 'Communication',   icon: '💬' },
  { id: 'ia',           label: 'Intelligence IA', icon: '🤖' },
  { id: 'paiement',     label: 'Paiement',        icon: '💳' },
  { id: 'calendrier',   label: 'Calendrier',      icon: '📅' },
  { id: 'marketing',    label: 'Marketing',       icon: '📣' },
  { id: 'automatisation',label:'Automatisation',  icon: '⚙️' },
  { id: 'signature',    label: 'Signature',       icon: '✍️' },
]

type FieldConfig = {
  key: string; label: string; type: 'text'|'password'|'url'|'checkbox'|'select'
  placeholder?: string; hint?: string; required?: boolean
  options?: string[]
}

type AppDef = {
  id: string; name: string; description: string; icon: string
  category: string; color: string; bg: string
  website: string; docs_url: string; pricing: string
  fields: FieldConfig[]
  features: string[]
  setup_steps: string[]
  is_native?: boolean  // already built-in to ClinicFlow
}

const APPS: AppDef[] = [
  // ── Communication ─────────────────────────────────────────────
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Envoi de WhatsApp et SMS dans les workflows. Notifiez vos patients automatiquement.',
    icon: '💬',
    category: 'communication',
    color: '#E31E28',
    bg: '#FEF2F2',
    website: 'https://twilio.com',
    docs_url: 'https://console.twilio.com',
    pricing: 'Pay as you go · ~0.005€/SMS · WhatsApp sandbox gratuit',
    features: ['WhatsApp Business', 'SMS', 'Rappels RDV automatiques', 'Workflows'],
    setup_steps: [
      'Créez un compte sur twilio.com',
      'Dans la console Twilio, copiez Account SID et Auth Token',
      'Pour WhatsApp : activez le Sandbox WhatsApp dans Messaging → Try it out',
      'Collez vos identifiants ci-dessous',
    ],
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: 'Votre auth token', required: true },
      { key: 'whatsapp_from', label: 'Numéro WhatsApp', type: 'text', placeholder: 'whatsapp:+14155238886', hint: 'Format whatsapp:+[numéro]' },
      { key: 'sms_from', label: 'Numéro SMS', type: 'text', placeholder: '+33755555555' },
    ],
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Envoi d\'emails transactionnels pour les workflows, confirmations et relances patients.',
    icon: '📧',
    category: 'communication',
    color: '#000000',
    bg: '#F9FAFB',
    website: 'https://resend.com',
    docs_url: 'https://resend.com/docs',
    pricing: '3 000 emails/mois gratuits · Puis 1.99$/10 000',
    features: ['Emails transactionnels', 'Templates HTML', 'Suivi d\'ouverture', 'Domaine personnalisé'],
    setup_steps: [
      'Créez un compte sur resend.com',
      'Vérifiez votre domaine email (DNS)',
      'Générez une clé API dans Settings → API Keys',
      'Collez la clé ci-dessous',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', placeholder: 're_xxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'from_email', label: 'Email expéditeur', type: 'text', placeholder: 'noreply@votreclinique.fr', required: true },
      { key: 'from_name', label: 'Nom expéditeur', type: 'text', placeholder: 'Dr. Martin — Clinique' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Recevez des notifications dans Slack lors d\'événements importants : nouveau patient, RDV manqué, workflow déclenché.',
    icon: '💜',
    category: 'communication',
    color: '#4A154B',
    bg: '#FAF5FF',
    website: 'https://slack.com',
    docs_url: 'https://api.slack.com/messaging/webhooks',
    pricing: 'Gratuit (plan Free)',
    features: ['Notifications temps réel', 'Alertes workflows', 'Nouveaux patients', 'Webhooks entrants'],
    setup_steps: [
      'Dans votre workspace Slack, allez dans Apps → Incoming Webhooks',
      'Cliquez "Add to Slack" et choisissez un canal',
      'Copiez l\'URL du webhook généré',
      'Collez-la ci-dessous',
    ],
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/T.../B.../...', required: true },
      { key: 'channel', label: 'Canal (optionnel)', type: 'text', placeholder: '#clinique-alertes' },
    ],
  },

  // ── IA ────────────────────────────────────────────────────────
  {
    id: 'openai',
    name: 'OpenAI (GPT-4)',
    description: 'Génération de comptes-rendus de consultation, résumés patients, et analyse intelligente.',
    icon: '🤖',
    category: 'ia',
    color: '#10A37F',
    bg: '#ECFDF5',
    website: 'https://openai.com',
    docs_url: 'https://platform.openai.com/api-keys',
    pricing: '~0.01$/1 000 tokens · GPT-4o ~0.005$',
    features: ['Transcription Whisper', 'Comptes-rendus IA', 'Résumés patients', 'Génération documents'],
    setup_steps: [
      'Créez un compte sur platform.openai.com',
      'Dans API Keys, créez une nouvelle clé',
      'Assurez-vous d\'avoir des crédits sur votre compte',
      'Collez la clé ci-dessous',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API OpenAI', type: 'password', placeholder: 'sk-proj-...', required: true },
      { key: 'model', label: 'Modèle préféré', type: 'select', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], placeholder: 'gpt-4o' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'IA médicale avancée pour l\'analyse d\'étiquettes injectables, rédaction de comptes-rendus et assistance clinique.',
    icon: '🧠',
    category: 'ia',
    color: '#D97706',
    bg: '#FFFBEB',
    website: 'https://anthropic.com',
    docs_url: 'https://console.anthropic.com/settings/keys',
    pricing: '~0.003$/1 000 tokens · Claude Haiku très économique',
    features: ['Scan étiquettes injectables', 'Vision médicale', 'Rédaction comptes-rendus', 'Analyse documents'],
    setup_steps: [
      'Connectez-vous sur console.anthropic.com',
      'Dans API Keys, créez une nouvelle clé',
      'Collez la clé ci-dessous',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API Anthropic', type: 'password', placeholder: 'sk-ant-...', required: true },
    ],
    is_native: true,
  },

  // ── Paiement ──────────────────────────────────────────────────
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Paiement en ligne, abonnements, et encaissement sécurisé. Les patients paient directement depuis les factures.',
    icon: '💳',
    category: 'paiement',
    color: '#635BFF',
    bg: '#EEF2FF',
    website: 'https://stripe.com',
    docs_url: 'https://dashboard.stripe.com/apikeys',
    pricing: '1.5% + 0.25€ par transaction carte européenne',
    features: ['Paiement en ligne', 'Lien de paiement', 'Abonnements', 'Factures auto'],
    setup_steps: [
      'Créez votre compte Stripe et activez votre compte commerçant',
      'Dans Dashboard → Développeurs → Clés API',
      'Copiez la Clé secrète (sk_live_...)',
      'Pour les webhooks, récupérez aussi le Signing Secret',
    ],
    fields: [
      { key: 'secret_key', label: 'Clé secrète', type: 'password', placeholder: 'sk_live_...', required: true, hint: 'Ne jamais partager cette clé' },
      { key: 'publishable_key', label: 'Clé publique', type: 'text', placeholder: 'pk_live_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
  },
  {
    id: 'sumup',
    name: 'SumUp',
    description: 'Terminal de paiement et paiement en ligne pour les cliniques. Populaire en médecine esthétique française.',
    icon: '💶',
    category: 'paiement',
    color: '#0A4A8F',
    bg: '#EFF6FF',
    website: 'https://sumup.fr',
    docs_url: 'https://developer.sumup.com',
    pricing: '1.69% par transaction · Pas de frais fixes',
    features: ['Terminal card reader', 'Paiement mobile', 'Remboursements', 'Rapports'],
    setup_steps: [
      'Créez un compte SumUp pro sur sumup.fr',
      'Dans Developer → My Applications, créez une app',
      'Récupérez le Client ID et Client Secret',
    ],
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'votre_client_id', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'votre_client_secret', required: true },
    ],
  },

  // ── Calendrier ────────────────────────────────────────────────
  {
    id: 'doctolib',
    name: 'Doctolib',
    description: 'Synchronisation automatique des RDV via iCal. Chaque nouveau RDV crée une fiche patient et déclenche un workflow.',
    icon: '🏥',
    category: 'calendrier',
    color: '#0596DE',
    bg: '#EFF6FF',
    website: 'https://doctolib.fr',
    docs_url: 'https://help.doctolib.fr',
    pricing: 'Inclus avec votre abonnement Doctolib',
    features: ['Sync RDV automatique', 'Création patient auto', 'Déclenchement workflows', 'Multi-praticiens'],
    setup_steps: [
      'Dans Doctolib, allez dans Paramètres → Agenda',
      'Cherchez "Synchronisation iCal" ou "Exporter l\'agenda"',
      'Copiez l\'URL iCal de votre agenda',
      'Collez l\'URL ci-dessous',
    ],
    fields: [
      { key: 'ical_url', label: 'URL iCal Doctolib', type: 'url', placeholder: 'https://www.doctolib.fr/agenda/...ics', required: true },
      { key: 'sync_interval_min', label: 'Fréquence synchro (minutes)', type: 'select', options: ['15', '30', '60', '120'], placeholder: '30' },
      { key: 'auto_create_patients', label: 'Créer patients automatiquement', type: 'checkbox' },
      { key: 'auto_trigger_workflows', label: 'Déclencher workflows automatiquement', type: 'checkbox' },
    ],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Synchronisez votre agenda Google avec ClinicFlow. Recevez vos RDV et créez des workflows automatiques.',
    icon: '📅',
    category: 'calendrier',
    color: '#1A73E8',
    bg: '#EFF6FF',
    website: 'https://calendar.google.com',
    docs_url: 'https://support.google.com/calendar/answer/37648',
    pricing: 'Gratuit avec Google Workspace',
    features: ['Sync agenda Google', 'RDV → workflows', 'Multi-calendriers', 'Notifications'],
    setup_steps: [
      'Dans Google Calendar, cliquez sur les 3 points à côté de votre agenda',
      'Cliquez "Paramètres et partage"',
      'Dans "Intégrer l\'agenda", copiez l\'URL iCal secrète',
      'Collez-la ci-dessous',
    ],
    fields: [
      { key: 'ical_url', label: 'URL iCal secrète', type: 'url', placeholder: 'https://calendar.google.com/calendar/ical/...ics', required: true },
    ],
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Prise de RDV en ligne intelligente. Les patients réservent directement, ClinicFlow crée les fiches.',
    icon: '🗓️',
    category: 'calendrier',
    color: '#006BFF',
    bg: '#EFF6FF',
    website: 'https://calendly.com',
    docs_url: 'https://developer.calendly.com',
    pricing: 'Gratuit (1 type d\'événement) · Pro 10€/mois',
    features: ['Booking en ligne', 'Sync bidirectionnelle', 'Webhooks', 'Rappels auto'],
    setup_steps: [
      'Dans Calendly, allez dans Account → Integrations',
      'Activez les webhooks et générez un Token personnel',
      'Collez le token ci-dessous',
    ],
    fields: [
      { key: 'api_token', label: 'Personal Access Token', type: 'password', placeholder: 'eyJraWQiOi...', required: true },
    ],
  },

  // ── Marketing ─────────────────────────────────────────────────
  {
    id: 'brevo',
    name: 'Brevo (ex Sendinblue)',
    description: 'Email marketing, newsletters et SMS pour fidéliser vos patients. Populaire en France.',
    icon: '📣',
    category: 'marketing',
    color: '#0B996E',
    bg: '#ECFDF5',
    website: 'https://brevo.com',
    docs_url: 'https://developers.brevo.com',
    pricing: '300 emails/jour gratuits · Pro 25€/mois',
    features: ['Email marketing', 'Newsletters', 'SMS marketing', 'Automatisations'],
    setup_steps: [
      'Créez un compte sur brevo.com',
      'Dans Settings → API Keys, créez une clé',
      'Collez la clé ci-dessous',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', placeholder: 'xkeysib-...', required: true },
      { key: 'sender_name', label: 'Nom expéditeur', type: 'text', placeholder: 'Dr. Martin' },
      { key: 'sender_email', label: 'Email expéditeur', type: 'text', placeholder: 'contact@votreclinique.fr' },
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Campagnes email marketing pour vos patients. Segments automatiques selon les traitements.',
    icon: '🐵',
    category: 'marketing',
    color: '#FFE01B',
    bg: '#FFFDE7',
    website: 'https://mailchimp.com',
    docs_url: 'https://mailchimp.com/developer',
    pricing: '500 contacts gratuits · Essentials 13€/mois',
    features: ['Email campaigns', 'Segmentation patients', 'Automatisations', 'Analytics'],
    setup_steps: [
      'Dans Mailchimp, allez dans Account → Extras → API Keys',
      'Créez une nouvelle clé API',
      'Collez la clé ci-dessous (format: xxx...xxx-dc99)',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-dc99', required: true },
      { key: 'audience_id', label: 'ID Audience / Liste', type: 'text', placeholder: 'ab12cd34ef', hint: 'Dans Audience → Settings → Audience name and defaults' },
    ],
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Suivez les performances de votre page de réservation et de vos campagnes marketing.',
    icon: '📊',
    category: 'marketing',
    color: '#F57C00',
    bg: '#FFF3E0',
    website: 'https://analytics.google.com',
    docs_url: 'https://support.google.com/analytics',
    pricing: 'Gratuit',
    features: ['Suivi page booking', 'Conversion', 'Sources trafic', 'Audiences'],
    setup_steps: [
      'Créez une propriété GA4 sur analytics.google.com',
      'Dans Admin → Data Streams, créez un flux web',
      'Copiez le Measurement ID (format G-XXXXXXXXXX)',
      'Collez-le ci-dessous',
    ],
    fields: [
      { key: 'measurement_id', label: 'Measurement ID', type: 'text', placeholder: 'G-XXXXXXXXXX', required: true },
    ],
  },

  // ── Automatisation ────────────────────────────────────────────
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Connectez ClinicFlow à +1000 applications via Make. Créez des scénarios avancés sans code.',
    icon: '⚙️',
    category: 'automatisation',
    color: '#6D00CC',
    bg: '#F5F0FF',
    website: 'https://make.com',
    docs_url: 'https://www.make.com/en/help/tools/webhooks',
    pricing: '1 000 opérations/mois gratuites · Core 9€/mois',
    features: ['+1000 apps connectées', 'Scénarios visuels', 'Webhooks bidirectionnels', 'Transformations données'],
    setup_steps: [
      'Dans Make, créez un scénario avec un déclencheur "Webhooks → Custom webhook"',
      'Copiez l\'URL du webhook générée',
      'Collez-la ci-dessous pour que ClinicFlow envoie des données à Make',
    ],
    fields: [
      { key: 'webhook_url', label: 'Webhook URL entrante', type: 'url', placeholder: 'https://hook.eu1.make.com/...', required: true, hint: 'ClinicFlow enverra les événements à cette URL' },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automatisez avec +5000 applications. Chaque événement ClinicFlow peut déclencher un Zap.',
    icon: '⚡',
    category: 'automatisation',
    color: '#FF4A00',
    bg: '#FFF4F0',
    website: 'https://zapier.com',
    docs_url: 'https://zapier.com/help/create/code-webhooks',
    pricing: '100 tâches/mois gratuites · Starter 20$/mois',
    features: ['+5000 apps', 'Multi-étapes', 'Webhooks', 'Filtres et conditions'],
    setup_steps: [
      'Dans Zapier, créez un Zap avec déclencheur "Webhooks by Zapier → Catch Hook"',
      'Copiez l\'URL du webhook',
      'Collez-la ci-dessous',
    ],
    fields: [
      { key: 'webhook_url', label: 'Webhook URL Zapier', type: 'url', placeholder: 'https://hooks.zapier.com/hooks/catch/...', required: true },
    ],
  },
  {
    id: 'n8n',
    name: 'n8n (self-hosted)',
    description: 'Automatisation open-source self-hosted. Pour les cliniques qui veulent garder leurs données.',
    icon: '🔧',
    category: 'automatisation',
    color: '#EA4B71',
    bg: '#FFF0F5',
    website: 'https://n8n.io',
    docs_url: 'https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.webhook',
    pricing: 'Open source gratuit · Cloud 20€/mois',
    features: ['Self-hosted', 'Open source', '200+ intégrations', 'Code JS/Python'],
    setup_steps: [
      'Installez n8n ou utilisez n8n.cloud',
      'Créez un workflow avec le nœud "Webhook"',
      'Copiez l\'URL de test ou de production',
      'Collez-la ci-dessous',
    ],
    fields: [
      { key: 'webhook_url', label: 'Webhook URL n8n', type: 'url', placeholder: 'https://votre-n8n.com/webhook/...', required: true },
      { key: 'api_key', label: 'API Key n8n (optionnel)', type: 'password', placeholder: 'Si authentification activée' },
    ],
  },

  // ── Signature ─────────────────────────────────────────────────
  {
    id: 'yousign',
    name: 'Yousign',
    description: 'Signature électronique légale française pour consentements et documents médicaux.',
    icon: '✍️',
    category: 'signature',
    color: '#6C2DC7',
    bg: '#F5F0FF',
    website: 'https://yousign.com',
    docs_url: 'https://developers.yousign.com',
    pricing: 'Essai gratuit · Business 35€/mois',
    features: ['Signature légale (eIDAS)', 'Consentements médicaux', 'Audit trail', 'Rappels auto'],
    setup_steps: [
      'Créez un compte Yousign et activez votre abonnement',
      'Dans Settings → API, créez une clé API',
      'Testez d\'abord en Sandbox avant de passer en Production',
      'Collez votre clé ci-dessous',
    ],
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', placeholder: 'Votre clé API Yousign', required: true },
      { key: 'sandbox', label: 'Mode Sandbox (test)', type: 'checkbox' },
    ],
    is_native: true,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Leader mondial de la signature électronique. Pour les cliniques avec forte exigence de conformité.',
    icon: '📝',
    category: 'signature',
    color: '#0A2B5C',
    bg: '#EFF4FF',
    website: 'https://docusign.com',
    docs_url: 'https://developers.docusign.com',
    pricing: 'Personal 10$/mois · Standard 25$/mois',
    features: ['Signature légale', 'Templates', 'Audit trail', 'Intégration Salesforce'],
    setup_steps: [
      'Créez un compte DocuSign Developer sur developers.docusign.com',
      'Dans Apps and Keys, créez une application',
      'Récupérez Account ID, Client ID et votre token',
    ],
    fields: [
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'integration_key', label: 'Integration Key', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'eyJ0eXAiOiJKV1Qi...', required: true },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────

export default function AppsPage() {
  const supabase = createClient()
  const [clinicId, setClinicId]             = useState('')
  const [integrations, setIntegrations]     = useState<Record<string, any>>({})
  const [loading, setLoading]               = useState(true)
  const [catFilter, setCatFilter]           = useState('all')
  const [search, setSearch]                 = useState('')
  const [selectedApp, setSelectedApp]       = useState<AppDef | null>(null)
  const [formValues, setFormValues]         = useState<Record<string, any>>({})
  const [testing, setTesting]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [testResult, setTestResult]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [toast, setToast]                   = useState<any>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const { data } = await supabase.from('app_integrations').select('*').eq('clinic_id', prof.clinic_id)
    const map: Record<string, any> = {}
    ;(data ?? []).forEach(i => { map[i.app_id] = i })
    setIntegrations(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openApp(app: AppDef) {
    setSelectedApp(app)
    setTestResult(null)
    const existing = integrations[app.id]
    setFormValues(existing?.config ?? {})
  }

  async function handleTest() {
    if (!selectedApp) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: selectedApp.id, config: formValues }),
      })
      const data = await res.json()
      setTestResult({ ok: data.success, msg: data.message })
      // Update test status in DB if integration exists
      if (integrations[selectedApp.id]) {
        await supabase.from('app_integrations').update({
          last_tested_at: new Date().toISOString(),
          last_test_status: data.success ? 'ok' : 'error',
          last_test_message: data.message,
        }).eq('clinic_id', clinicId).eq('app_id', selectedApp.id)
      }
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) })
    }
    setTesting(false)
  }

  async function handleSave() {
    if (!selectedApp || !clinicId) return
    setSaving(true)
    await supabase.from('app_integrations').upsert({
      clinic_id: clinicId,
      app_id: selectedApp.id,
      is_active: true,
      config: formValues,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id,app_id' })
    setSaving(false)
    showToast(`✓ ${selectedApp.name} connecté`)
    setSelectedApp(null)
    load()
  }

  async function handleDisconnect(appId: string) {
    if (!confirm('Déconnecter cette application ?')) return
    await supabase.from('app_integrations').update({ is_active: false, config: {} }).eq('clinic_id', clinicId).eq('app_id', appId)
    load()
    showToast('Application déconnectée')
  }

  const filtered = APPS.filter(app => {
    if (catFilter !== 'all' && app.category !== catFilter) return false
    if (search && !app.name.toLowerCase().includes(search.toLowerCase()) && !app.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const connectedCount = Object.values(integrations).filter(i => i.is_active).length

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header">
        <div className="page-title">Applications & Intégrations</div>
        <div className="page-subtitle">
          {APPS.length} applications disponibles · {connectedCount} connectée{connectedCount > 1 ? 's' : ''}
        </div>
      </div>

      <div className="page-content">
        {/* Search + filters */}
        <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher une application..." style={{ maxWidth:280, fontSize:13 }} />
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {APP_CATEGORIES.map(cat => {
              const count = cat.id === 'all' ? APPS.length : APPS.filter(a => a.category === cat.id).length
              return (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                  style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: catFilter===cat.id ? '#0F172A' : 'white', color: catFilter===cat.id ? 'white' : 'var(--gray-600)', border: catFilter===cat.id ? 'none' : '1px solid var(--gray-200)', display:'flex', alignItems:'center', gap:4 }}>
                  {cat.icon} {cat.label} <span style={{ opacity:.6 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Apps grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {filtered.map(app => {
            const integration = integrations[app.id]
            const isConnected = integration?.is_active
            const lastStatus = integration?.last_test_status

            return (
              <div key={app.id} className="card" style={{ padding:18, cursor:'pointer', transition:'all .15s', position:'relative' }}
                onClick={() => openApp(app)}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>

                {/* Connected badge */}
                {isConnected && (
                  <div style={{ position:'absolute', top:12, right:12, fontSize:10, fontWeight:700, background:'#ECFDF5', color:'#059669', padding:'2px 7px', borderRadius:99, border:'1px solid #BBF7D0' }}>
                    ● Connecté{lastStatus === 'error' ? ' ⚠️' : ''}
                  </div>
                )}
                {app.is_native && (
                  <div style={{ position:'absolute', top:12, right:isConnected ? 80 : 12, fontSize:9, fontWeight:700, background:'#EFF6FF', color:'var(--blue)', padding:'2px 6px', borderRadius:99 }}>
                    NATIF
                  </div>
                )}

                <div style={{ display:'flex', gap:12, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:44, height:44, borderRadius:11, background:app.bg, border:`1px solid ${app.color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {app.icon}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:2 }}>{app.name}</div>
                    <div style={{ fontSize:10, fontWeight:600, color:app.color, background:app.bg, display:'inline-block', padding:'1px 6px', borderRadius:99 }}>
                      {APP_CATEGORIES.find(c => c.id === app.category)?.icon} {APP_CATEGORIES.find(c => c.id === app.category)?.label}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize:12.5, color:'var(--gray-600)', lineHeight:1.5, marginBottom:10 }}>{app.description}</p>

                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
                  {app.features.slice(0, 3).map(f => (
                    <span key={f} style={{ fontSize:10, background:'var(--gray-100)', color:'var(--gray-600)', padding:'2px 6px', borderRadius:99 }}>{f}</span>
                  ))}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--gray-400)' }}>{app.pricing.split('·')[0].trim()}</span>
                  <button
                    onClick={e => { e.stopPropagation(); openApp(app) }}
                    style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${isConnected ? 'var(--gray-200)' : app.color}`, background: isConnected ? 'white' : app.bg, color: isConnected ? 'var(--gray-600)' : app.color, cursor:'pointer', fontWeight:600 }}>
                    {isConnected ? '⚙️ Configurer' : '+ Connecter'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal configuration app */}
      {selectedApp && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:580, maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ flexShrink:0, borderBottom:`3px solid ${selectedApp.color}` }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:selectedApp.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                  {selectedApp.icon}
                </div>
                <div>
                  <div className="modal-title">{selectedApp.name}</div>
                  <a href={selectedApp.website} target="_blank" style={{ fontSize:11, color:'var(--blue)', textDecoration:'none' }}>
                    {selectedApp.website.replace('https://','')} ↗
                  </a>
                </div>
                {integrations[selectedApp.id]?.is_active && (
                  <button onClick={() => handleDisconnect(selectedApp.id)}
                    style={{ marginLeft:'auto', marginRight:32, fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer' }}>
                    Déconnecter
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedApp(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 }}>
              {/* Pricing + features */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ padding:'10px 12px', background:'var(--gray-50)', borderRadius:9 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Fonctionnalités</div>
                  {selectedApp.features.map(f => (
                    <div key={f} style={{ fontSize:12, color:'var(--gray-600)', display:'flex', gap:5, marginBottom:2 }}>
                      <span style={{ color:'var(--blue)' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <div style={{ padding:'10px 12px', background:selectedApp.bg, borderRadius:9 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:selectedApp.color, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Tarification</div>
                  <div style={{ fontSize:12, color:selectedApp.color }}>{selectedApp.pricing}</div>
                  <a href={selectedApp.docs_url} target="_blank" style={{ fontSize:11, color:selectedApp.color, textDecoration:'none', display:'block', marginTop:6 }}>
                    📚 Documentation ↗
                  </a>
                </div>
              </div>

              {/* Setup steps */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', marginBottom:8 }}>Guide de configuration</div>
                {selectedApp.setup_steps.map((step, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'flex-start' }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background:selectedApp.color, color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</span>
                    <span style={{ fontSize:12.5, color:'var(--gray-600)', lineHeight:1.5 }}>{step}</span>
                  </div>
                ))}
              </div>

              {/* Config fields */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-700)', marginBottom:10 }}>Configuration</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {selectedApp.fields.map(field => (
                    <div key={field.key}>
                      <label className="label">
                        {field.label} {field.required && <span style={{ color:'var(--red)' }}>*</span>}
                      </label>
                      {field.type === 'checkbox' ? (
                        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                          <input type="checkbox" checked={!!formValues[field.key]} onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.checked }))} style={{ accentColor:selectedApp.color }} />
                          <span style={{ fontSize:13, color:'var(--gray-700)' }}>{field.label}</span>
                        </label>
                      ) : field.type === 'select' ? (
                        <select className="input" value={formValues[field.key] ?? field.options?.[0] ?? ''}
                          onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))} style={{ fontSize:13 }}>
                          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="input" type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                          value={formValues[field.key] ?? ''} onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                          placeholder={field.placeholder} style={{ fontSize:13 }} />
                      )}
                      {field.hint && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>💡 {field.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div style={{ padding:'10px 14px', borderRadius:9, background: testResult.ok ? '#ECFDF5' : '#FEF2F2', border:`1px solid ${testResult.ok ? '#BBF7D0' : '#FECACA'}`, display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:16 }}>{testResult.ok ? '✅' : '❌'}</span>
                  <span style={{ fontSize:13, fontWeight:500, color: testResult.ok ? '#059669' : '#DC2626' }}>{testResult.msg}</span>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ flexShrink:0 }}>
              <button onClick={() => setSelectedApp(null)} className="btn-secondary">Fermer</button>
              <button onClick={handleTest} disabled={testing}
                style={{ fontSize:13, padding:'8px 16px', borderRadius:8, border:`1px solid ${selectedApp.color}40`, background:selectedApp.bg, color:selectedApp.color, cursor:'pointer', fontWeight:600 }}>
                {testing ? 'Test...' : '🔌 Tester la connexion'}
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ background:selectedApp.color }}>
                {saving ? 'Enregistrement...' : testResult?.ok ? '✅ Sauvegarder' : '💾 Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
