import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('patient_intake_forms')
    .select('*, clinic:clinics(name, id)')
    .eq('token', token)
    .single()

  if (!data) return NextResponse.json({ error: 'Form not found or expired' }, { status: 404 })
  if (data.status !== 'pending' || new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Form expired or already completed' }, { status: 410 })
  }

  return NextResponse.json({ form: data })
}

export async function POST(request: NextRequest) {
  try {
    const { token, form_data } = await request.json()
    const supabase = getSupabase()

    const { data: intake } = await supabase
      .from('patient_intake_forms')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (!intake) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

    // Update intake form
    await supabase.from('patient_intake_forms').update({
      status: 'completed',
      form_data,
      completed_at: new Date().toISOString(),
    }).eq('token', token)

    // Update patient with the new info
    if (intake.patient_id) {
      const updates: Record<string, any> = {}
      if (form_data.email)        updates.email = form_data.email
      if (form_data.phone)        updates.phone = form_data.phone
      if (form_data.date_of_birth) updates.date_of_birth = form_data.date_of_birth
      if (form_data.notes)        updates.notes = form_data.notes

      if (Object.keys(updates).length > 0) {
        await supabase.from('patients').update(updates).eq('id', intake.patient_id)
      }

      // Create patient alert if allergies or contraindications mentioned
      if (form_data.allergies) {
        await supabase.from('patient_alerts').insert({
          patient_id: intake.patient_id,
          clinic_id: intake.clinic_id,
          type: 'allergy',
          message: `Allergies déclarées : ${form_data.allergies}`,
          severity: 'high',
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
