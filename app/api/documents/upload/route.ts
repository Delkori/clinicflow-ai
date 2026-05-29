import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clinic_id = formData.get('clinic_id') as string
    const name = formData.get('name') as string
    const type = (formData.get('type') as string) ?? 'custom'

    if (!file || !clinic_id) {
      return NextResponse.json({ error: 'File and clinic_id required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // For HTML/text files — read content directly
    if (file.type.includes('text') || file.type.includes('html') || file.name.endsWith('.html')) {
      const content = await file.text()
      const { data, error } = await supabase
        .from('document_templates')
        .insert({
          clinic_id,
          name: name || file.name.replace(/\.[^/.]+$/, ''),
          type: type as any,
          content,
          category: 'imported',
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, template: data, message: 'Template HTML importé' })
    }

    // For PDF files — upload to storage and create a template with PDF reference
    if (file.type === 'application/pdf') {
      const path = `${clinic_id}/templates/${Date.now()}_${file.name}`
      const bytes = await file.arrayBuffer()
      const { data: uploaded, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(uploaded.path)

      // Create a template that embeds the PDF via iframe
      const content = `<div style="font-family: -apple-system, sans-serif; padding: 40px;">
  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <p style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>Document :</strong> ${name || file.name}</p>
    <p style="font-size: 13px; color: #64748B;">Patient : <strong>{{patient_name}}</strong> | Date : {{today}}</p>
  </div>
  <iframe src="${publicUrl}" width="100%" height="600" style="border: 1px solid #E2E8F0; border-radius: 8px;"></iframe>
  <div style="margin-top: 40px; display: flex; justify-content: space-between;">
    <div>
      <p style="font-size: 13px; color: #64748B;">Signature du patient</p>
      <div style="width: 200px; height: 50px; border-bottom: 1px solid #CBD5E1; margin-top: 8px;"></div>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 4px;">{{patient_name}} — {{today}}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 13px; color: #64748B;">Clinique</p>
      <div style="width: 200px; height: 50px; border-bottom: 1px solid #CBD5E1; margin-top: 8px;"></div>
      <p style="font-size: 12px; color: #94A3B8; margin-top: 4px;">{{clinic_name}}</p>
    </div>
  </div>
</div>`

      const { data, error } = await supabase
        .from('document_templates')
        .insert({
          clinic_id,
          name: name || file.name.replace('.pdf', ''),
          type: type as any,
          content,
          category: 'imported',
          variables: [
            { key: 'patient_name', label: 'Nom du patient' },
            { key: 'today', label: "Date d'aujourd'hui" },
            { key: 'clinic_name', label: 'Nom de la clinique' },
          ],
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, template: data, pdf_url: publicUrl, message: 'PDF importé et template créé' })
    }

    return NextResponse.json({ error: 'Format non supporté. Utilisez HTML ou PDF.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
