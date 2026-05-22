import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { consultation_id, treatment_id, patient_id, clinic_id } = await request.json()
    if (!treatment_id || !patient_id || !clinic_id) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    // Find active workflow for this treatment
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, steps:workflow_steps(*)')
      .eq('treatment_id', treatment_id)
      .eq('clinic_id', clinic_id)
      .eq('is_active', true)
      .single()

    if (!workflow || !workflow.steps?.length) {
      return NextResponse.json({ message: 'No active workflow found' })
    }

    const consultationDate = new Date()
    const executions = workflow.steps
      .filter((step: any) => step.is_active && step.timing_reference === 'consultation')
      .map((step: any) => {
        const scheduledAt = new Date(consultationDate)
        scheduledAt.setDate(scheduledAt.getDate() + step.timing_days)
        return {
          patient_id,
          clinic_id,
          workflow_id: workflow.id,
          step_id: step.id,
          consultation_id: consultation_id ?? null,
          status: 'pending',
          scheduled_at: scheduledAt.toISOString(),
        }
      })

    if (executions.length > 0) {
      const { error } = await supabase.from('workflow_executions').insert(executions)
      if (error) throw error
    }

    return NextResponse.json({ 
      message: `${executions.length} automations scheduled`,
      count: executions.length
    })
  } catch (error) {
    console.error('Workflow trigger error:', error)
    return NextResponse.json({ error: 'Failed to trigger workflow' }, { status: 500 })
  }
}
