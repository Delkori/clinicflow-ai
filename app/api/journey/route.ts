import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { patient_id, clinic_id, treatment_id, consultation_id, treatment_name } = await request.json()
    const supabase = getSupabase()

    const { data: journey, error } = await supabase.from('patient_journeys').insert({
      patient_id, clinic_id, treatment_id, consultation_id, stage: 'consultation', score: 20,
    }).select().single()

    if (error || !journey) return NextResponse.json({ error: error?.message }, { status: 400 })

    // Create treatment-specific checklist
    await supabase.rpc('create_journey_checklist', {
      p_journey_id: journey.id, p_clinic_id: clinic_id, p_treatment_name: treatment_name ?? '',
    })

    // Create default journey documents
    await supabase.from('journey_documents').insert([
      { journey_id: journey.id, clinic_id, label: 'Consentement éclairé', type: 'consentement', status: 'pending' },
      { journey_id: journey.id, clinic_id, label: 'Devis intervention', type: 'devis', status: 'pending' },
      { journey_id: journey.id, clinic_id, label: 'Instructions pré-opératoires', type: 'pre_op', status: 'pending' },
      { journey_id: journey.id, clinic_id, label: 'Photo avant (J0)', type: 'photo_before', status: 'pending' },
    ])

    return NextResponse.json({ journey })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create journey' }, { status: 500 })
  }
}
