import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { document_id, signer_name, signer_email } = await request.json()
    const supabase = getSupabase()

    const { data: doc } = await supabase
      .from('generated_documents')
      .select('*, patient:patients(first_name, last_name, email)')
      .eq('id', document_id)
      .single()

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const yousignKey = process.env.YOUSIGN_API_KEY
    const yousignBase = process.env.YOUSIGN_SANDBOX === 'true'
      ? 'https://api-sandbox.yousign.app/v3'
      : 'https://api.yousign.app/v3'

    if (!yousignKey || yousignKey === 'your_yousign_key_here') {
      // Demo mode — create a fake signature request
      const fakeToken = `demo_${Date.now()}`
      const demoUrl = `https://app.yousign.com/procedure/sign?members=${fakeToken}`

      await supabase.from('generated_documents').update({
        status: 'sent',
        signature_provider: 'yousign',
        signature_request_id: fakeToken,
        signature_url: demoUrl,
        signer_email: signer_email || doc.signer_email,
      }).eq('id', document_id)

      return NextResponse.json({
        success: true,
        simulated: true,
        signature_url: demoUrl,
        message: 'Mode démo — configurez votre clé Yousign dans Paramètres → Intégrations',
      })
    }

    // 1. Create signature request
    const signatureReq = await fetch(`${yousignBase}/signature_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${yousignKey}`,
      },
      body: JSON.stringify({
        name: doc.name,
        delivery_mode: 'email',
        timezone: 'Europe/Paris',
      }),
    })
    const signatureData = await signatureReq.json()
    if (!signatureReq.ok) throw new Error(signatureData.detail ?? 'Yousign error')

    const requestId = signatureData.id

    // 2. Upload document (HTML → PDF via Yousign)
    const docRes = await fetch(`${yousignBase}/signature_requests/${requestId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${yousignKey}`,
      },
      body: JSON.stringify({
        nature: 'signable_document',
        content: Buffer.from(doc.html_content ?? '').toString('base64'),
        filename: `${doc.name}.html`,
        content_type: 'text/html',
      }),
    })
    const docData = await docRes.json()

    // 3. Add signer
    const signerRes = await fetch(`${yousignBase}/signature_requests/${requestId}/signers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${yousignKey}`,
      },
      body: JSON.stringify({
        info: {
          first_name: doc.patient?.first_name ?? signer_name.split(' ')[0],
          last_name: doc.patient?.last_name ?? signer_name.split(' ').slice(1).join(' '),
          email: signer_email || doc.patient?.email,
          locale: 'fr',
        },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'no_otp',
        fields: [{
          document_id: docData.id,
          type: 'signature',
          page: 1,
          x: 70, y: 700,
          width: 200, height: 60,
        }],
      }),
    })
    const signerData = await signerRes.json()

    // 4. Activate the request
    await fetch(`${yousignBase}/signature_requests/${requestId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${yousignKey}` },
    })

    const signatureUrl = signerData.signature_link

    // Save to DB
    await supabase.from('generated_documents').update({
      status: 'sent',
      signature_provider: 'yousign',
      signature_request_id: requestId,
      signature_url: signatureUrl,
      signer_email: signer_email || doc.signer_email,
    }).eq('id', document_id)

    return NextResponse.json({
      success: true,
      signature_url: signatureUrl,
      request_id: requestId,
    })
  } catch (err: any) {
    console.error('Yousign error:', err)
    return NextResponse.json({ error: err.message ?? 'Signature failed' }, { status: 500 })
  }
}

// Webhook handler for Yousign events
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = getSupabase()

    if (body.event_type === 'signer.done') {
      const requestId = body.data?.signature_request?.id
      if (requestId) {
        await supabase.from('generated_documents')
          .update({ status: 'signed', signed_at: new Date().toISOString() })
          .eq('signature_request_id', requestId)
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
