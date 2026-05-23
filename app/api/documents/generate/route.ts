import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  // Handle {{#if key}}...{{/if}} blocks
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : ''
  })
  // Replace variables
  result = result.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
  return result
}

export async function POST(request: NextRequest) {
  try {
    const { template_id, patient_id, consultation_id, custom_vars = {} } = await request.json()
    const supabase = getSupabase()

    // Load template
    const { data: template } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', template_id)
      .single()

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    // Load patient data
    const { data: patient } = await supabase
      .from('patients')
      .select('*, clinic:clinics(name)')
      .eq('id', patient_id)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Load consultation if provided
    let consultData: Record<string, string> = {}
    if (consultation_id) {
      const { data: consult } = await supabase
        .from('consultations')
        .select('*, treatment:treatments(name)')
        .eq('id', consultation_id)
        .single()
      if (consult?.structured_data) {
        consultData = consult.structured_data as Record<string, string>
      }
      if (consult?.treatment?.name) {
        consultData.treatment_name = consult.treatment.name
      }
    }

    // Build variables map
    const today = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    const vars: Record<string, string> = {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      date_of_birth: patient.date_of_birth
        ? new Date(patient.date_of_birth).toLocaleDateString('fr-FR') : '',
      clinic_name: (patient as any).clinic?.name ?? 'Votre Clinique',
      doctor_name: 'Médecin',
      today,
      intervention_date: today,
      devis_number: `DEV-${Date.now().toString().slice(-6)}`,
      ...consultData,
      ...custom_vars,
    }

    const html = interpolate(template.content, vars)

    // Wrap in full HTML doc for rendering
    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${html}</body>
</html>`

    // Save the generated document
    const { data: doc, error } = await supabase
      .from('generated_documents')
      .insert({
        clinic_id: patient.clinic_id,
        patient_id,
        template_id,
        consultation_id: consultation_id ?? null,
        name: `${template.name} — ${patient.first_name} ${patient.last_name}`,
        type: template.type,
        html_content: fullHtml,
        status: 'generated',
        signer_email: patient.email,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      document: doc,
      html: fullHtml,
    })
  } catch (err) {
    console.error('Generate doc error:', err)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
