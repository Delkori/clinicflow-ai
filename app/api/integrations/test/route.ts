import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { app_id, config } = await request.json()

  try {
    switch (app_id) {

      // ── TWILIO (WhatsApp/SMS) ──────────────────────────────────
      case 'twilio': {
        const { account_sid, auth_token } = config
        if (!account_sid || !auth_token) return err('SID et Auth Token requis')
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
          headers: { Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64') }
        })
        if (!res.ok) return err('Identifiants Twilio invalides')
        const data = await res.json()
        return ok(`Compte Twilio actif — ${data.friendly_name || data.sid}`)
      }

      // ── RESEND (Email) ─────────────────────────────────────────
      case 'resend': {
        const { api_key } = config
        if (!api_key) return err('Clé API Resend requise')
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${api_key}` }
        })
        if (!res.ok) return err('Clé API Resend invalide')
        const data = await res.json()
        const domains = data.data?.length ?? 0
        return ok(`Resend connecté — ${domains} domaine${domains > 1 ? 's' : ''} vérifié${domains > 1 ? 's' : ''}`)
      }

      // ── STRIPE ────────────────────────────────────────────────
      case 'stripe': {
        const { secret_key } = config
        if (!secret_key) return err('Clé secrète Stripe requise')
        const res = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${secret_key}` }
        })
        if (!res.ok) return err('Clé Stripe invalide')
        const data = await res.json()
        return ok(`Stripe connecté — ${data.business_profile?.name ?? data.email ?? data.id}`)
      }

      // ── YOUSIGN (Signature) ───────────────────────────────────
      case 'yousign': {
        const { api_key, sandbox } = config
        if (!api_key) return err('Clé API Yousign requise')
        const base = sandbox ? 'https://api-sandbox.yousign.app/v3' : 'https://api.yousign.app/v3'
        const res = await fetch(`${base}/users`, {
          headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' }
        })
        if (!res.ok) return err('Clé Yousign invalide ou expirée')
        return ok(`Yousign connecté ${sandbox ? '(Sandbox)' : '(Production)'}`)
      }

      // ── OPENAI ────────────────────────────────────────────────
      case 'openai': {
        const { api_key } = config
        if (!api_key) return err('Clé API OpenAI requise')
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${api_key}` }
        })
        if (!res.ok) return err('Clé OpenAI invalide')
        const data = await res.json()
        const models = data.data?.filter((m: any) => m.id.includes('gpt')).length ?? 0
        return ok(`OpenAI connecté — ${models} modèles GPT disponibles`)
      }

      // ── ANTHROPIC (Claude) ────────────────────────────────────
      case 'anthropic': {
        const { api_key } = config
        if (!api_key) return err('Clé API Anthropic requise')
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        })
        if (!res.ok) return err('Clé Anthropic invalide')
        return ok('Claude (Anthropic) connecté — IA transcription prête')
      }

      // ── DOCTOLIB (iCal) ───────────────────────────────────────
      case 'doctolib': {
        const { ical_url } = config
        if (!ical_url) return err('URL iCal Doctolib requise')
        if (!ical_url.includes('doctolib') && !ical_url.includes('.ics')) {
          return err('L\'URL doit être une URL iCal Doctolib (.ics)')
        }
        const res = await fetch(ical_url)
        if (!res.ok) return err('URL iCal inaccessible — vérifiez le lien Doctolib')
        const text = await res.text()
        const events = (text.match(/BEGIN:VEVENT/g) || []).length
        return ok(`Calendrier Doctolib accessible — ${events} RDV synchronisables`)
      }

      // ── GOOGLE CALENDAR ────────────────────────────────────────
      case 'google_calendar': {
        const { ical_url } = config
        if (!ical_url) return err('URL iCal Google Calendar requise')
        const res = await fetch(ical_url)
        if (!res.ok) return err('URL iCal inaccessible')
        return ok('Google Calendar synchronisé')
      }

      // ── SLACK ────────────────────────────────────────────────
      case 'slack': {
        const { webhook_url } = config
        if (!webhook_url) return err('Webhook URL Slack requise')
        const res = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '✅ ClinicFlow AI connecté à ce canal Slack !' })
        })
        if (!res.ok) return err('Webhook Slack invalide')
        return ok('Slack connecté — message de test envoyé dans le canal')
      }

      // ── MAKE (Integromat) ─────────────────────────────────────
      case 'make': {
        const { webhook_url } = config
        if (!webhook_url) return err('Webhook Make requis')
        const res = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'clinicflow', timestamp: new Date().toISOString() })
        })
        if (res.status >= 400) return err('Webhook Make invalide')
        return ok('Make (Integromat) connecté — scénario déclenché avec succès')
      }

      // ── ZAPIER ────────────────────────────────────────────────
      case 'zapier': {
        const { webhook_url } = config
        if (!webhook_url) return err('Webhook Zapier requis')
        const res = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'clinicflow', timestamp: new Date().toISOString() })
        })
        if (res.status >= 400) return err('Webhook Zapier invalide')
        return ok('Zapier connecté — trigger testé avec succès')
      }

      // ── MAILCHIMP ─────────────────────────────────────────────
      case 'mailchimp': {
        const { api_key } = config
        if (!api_key) return err('Clé API Mailchimp requise')
        const dc = api_key.split('-').pop()
        const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, {
          headers: { Authorization: `apikey ${api_key}` }
        })
        if (!res.ok) return err('Clé Mailchimp invalide')
        return ok('Mailchimp connecté — listes email synchronisables')
      }

      // ── BREVO (ex Sendinblue) ─────────────────────────────────
      case 'brevo': {
        const { api_key } = config
        if (!api_key) return err('Clé API Brevo requise')
        const res = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': api_key }
        })
        if (!res.ok) return err('Clé Brevo invalide')
        const data = await res.json()
        return ok(`Brevo connecté — ${data.email}`)
      }

      // ── GOOGLE ANALYTICS ──────────────────────────────────────
      case 'google_analytics': {
        const { measurement_id } = config
        if (!measurement_id || !measurement_id.startsWith('G-')) return err('Measurement ID invalide (format: G-XXXXXXXX)')
        return ok(`Google Analytics configuré — ID: ${measurement_id}`)
      }

      default:
        return err(`Intégration "${app_id}" non reconnue`)
    }
  } catch (e) {
    return err(`Erreur réseau : ${String(e)}`)
  }
}

function ok(message: string) {
  return NextResponse.json({ success: true, message })
}
function err(message: string) {
  return NextResponse.json({ success: false, message })
}
