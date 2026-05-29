import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, c) => vars[k] ? c : '')
  result = result.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
  return result
}

export async function POST(request: NextRequest) {
  try {
    const {
      clinic_id, patient_id, template_id,
      custom_vars = {}, send_email = true, send_whatsapp = false,
      signer_name, signer_email,
    } = await request.json()

    const supabase = getSupabase()

    // Load template + patient
    const [{ data: template }, { data: patient }] = await Promise.all([
      supabase.from('document_templates').select('*').eq('id', template_id).single(),
      supabase.from('patients').select('*, clinic:clinics(name)').eq('id', patient_id).single(),
    ])

    if (!template || !patient) {
      return NextResponse.json({ error: 'Template ou patient introuvable' }, { status: 404 })
    }

    const clinicName = (patient as any).clinic?.name ?? 'Votre Clinique'
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    const vars: Record<string, string> = {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      clinic_name: clinicName,
      doctor_name: 'Médecin',
      today,
      intervention_date: today,
      devis_number: `DEV-${Date.now().toString().slice(-6)}`,
      ...custom_vars,
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${template.name} — ${vars.patient_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${interpolate(template.content, vars)}</body>
</html>`

    const finalSignerEmail = signer_email || patient.email
    const finalSignerName  = signer_name  || `${patient.first_name} ${patient.last_name}`

    // Create sign request record
    const { data: signReq, error } = await supabase
      .from('document_sign_requests')
      .insert({
        clinic_id,
        patient_id,
        template_id,
        name: `${template.name} — ${vars.patient_name}`,
        html_content: htmlContent,
        variables_used: vars,
        signer_name: finalSignerName,
        signer_email: finalSignerEmail,
        status: 'draft',
      })
      .select()
      .single()

    if (error || !signReq) throw error ?? new Error('Création sign request failed')

    // Call Yousign
    const yousignKey = process.env.YOUSIGN_API_KEY
    const yousignBase = process.env.YOUSIGN_SANDBOX === 'true'
      ? 'https://api-sandbox.yousign.app/v3'
      : 'https://api.yousign.app/v3'

    let signatureUrl: string
    let requestId: string

    if (!yousignKey || yousignKey.includes('your_')) {
      // Demo mode
      requestId = `demo_${signReq.id.slice(0, 8)}`
      signatureUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://clinicflow-ai-delkoris-projects.vercel.app'}/sign/demo/${signReq.id}`

      await supabase.from('document_sign_requests').update({
        status: 'sent',
        signature_request_id: requestId,
        signature_url: signatureUrl,
        sent_at: new Date().toISOString(),
      }).eq('id', signReq.id)
    } else {
      // Real Yousign
      const srRes = await fetch(`${yousignBase}/signature_requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${yousignKey}` },
        body: JSON.stringify({ name: signReq.name, delivery_mode: 'email', timezone: 'Europe/Paris' }),
      })
      const srData = await srRes.json()
      if (!srRes.ok) throw new Error(srData.detail ?? 'Yousign error')
      requestId = srData.id

      // Upload document
      const docRes = await fetch(`${yousignBase}/signature_requests/${requestId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${yousignKey}` },
        body: JSON.stringify({
          nature: 'signable_document',
          content: Buffer.from(htmlContent).toString('base64'),
          filename: `${signReq.name}.html`,
          content_type: 'text/html',
        }),
      })
      const docData = await docRes.json()

      // Add signer
      const signerRes = await fetch(`${yousignBase}/signature_requests/${requestId}/signers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${yousignKey}` },
        body: JSON.stringify({
          info: { first_name: patient.first_name, last_name: patient.last_name, email: finalSignerEmail, locale: 'fr' },
          signature_level: 'electronic_signature',
          signature_authentication_mode: 'no_otp',
          fields: [{ document_id: docData.id, type: 'signature', page: 1, x: 70, y: 700, width: 200, height: 60 }],
        }),
      })
      const signerData = await signerRes.json()
      signatureUrl = signerData.signature_link

      await fetch(`${yousignBase}/signature_requests/${requestId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${yousignKey}` },
      })

      await supabase.from('document_sign_requests').update({
        status: 'sent',
        signature_request_id: requestId,
        signature_url: signatureUrl,
        sent_at: new Date().toISOString(),
      }).eq('id', signReq.id)
    }

    // Send email notification
    if (send_email && finalSignerEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clinicflow-ai-delkoris-projects.vercel.app'
      await fetch(`${appUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id,
          subject: `Document à signer : ${template.name} — ${clinicName}`,
          body: `Bonjour {{first_name}},\n\nVeuillez signer le document suivant pour valider votre prise en charge : **${template.name}**\n\nCliquez sur le lien ci-dessous pour signer électroniquement :\n${signatureUrl}\n\nCe lien est valable 30 jours.\n\nCordialement,\n${clinicName}`,
        }),
      }).catch(() => {})
      await supabase.from('document_sign_requests').update({ email_sent: true }).eq('id', signReq.id)
    }

    return NextResponse.json({
      success: true,
      sign_request: { ...signReq, signature_url: signatureUrl, signature_request_id: requestId },
      signature_url: signatureUrl,
      simulated: !yousignKey || yousignKey.includes('your_'),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const patient_id = request.nextUrl.searchParams.get('patient_id')
  const clinic_id  = request.nextUrl.searchParams.get('clinic_id')
  if (!patient_id && !clinic_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  const supabase = getSupabase()
  const q = supabase.from('document_sign_requests').select('*').order('created_at', { ascending: false })
  if (patient_id) q.eq('patient_id', patient_id)
  if (clinic_id)  q.eq('clinic_id', clinic_id)

  const { data } = await q
  return NextResponse.json({ requests: data ?? [] })
}
