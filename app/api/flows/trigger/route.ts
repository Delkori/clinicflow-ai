import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export async function POST(request: NextRequest) {
  try {
    const { trigger_type, clinic_id, patient_id, trigger_data = {} } = await request.json()
    const supabase = getSupabase()

    // Find active workflows matching this trigger
    const { data: workflows } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('trigger_type', trigger_type)
      .eq('is_active', true)

    if (!workflows?.length) return NextResponse.json({ triggered: 0 })

    // Load patient context
    const { data: patient } = await supabase
      .from('patients')
      .select('*, clinic:clinics(name)')
      .eq('id', patient_id)
      .maybeSingle()

    // Load intake form if exists
    const { data: intakeForm } = await supabase
      .from('patient_intake_forms')
      .select('token')
      .eq('patient_id', patient_id)
      .eq('status', 'pending')
      .maybeSingle()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clinicflow-ai-delkoris-projects.vercel.app'

    const context: Record<string, string> = {
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : '',
      first_name:   patient?.first_name ?? '',
      last_name:    patient?.last_name ?? '',
      email:        patient?.email ?? '',
      phone:        patient?.phone ?? '',
      clinic_name:  (patient as any)?.clinic?.name ?? '',
      intake_link:  intakeForm ? `${baseUrl}/intake/${intakeForm.token}` : '',
      ...trigger_data,
    }

    const triggered = []

    for (const workflow of workflows) {
      // Create run instance
      const { data: run } = await supabase.from('workflow_runs').insert({
        clinic_id,
        workflow_id: workflow.id,
        patient_id,
        trigger_type,
        trigger_data,
        status: 'running',
        context,
      }).select().single()

      if (!run) continue

      // Execute the flow starting from trigger node
      await executeFlow(supabase, run, workflow, context, baseUrl)

      // Update workflow stats
      await supabase.from('workflow_definitions').update({
        run_count: (workflow.run_count ?? 0) + 1,
        last_run_at: new Date().toISOString(),
      }).eq('id', workflow.id)

      triggered.push(workflow.name)
    }

    return NextResponse.json({ triggered: triggered.length, workflows: triggered })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function executeFlow(supabase: any, run: any, workflow: any, context: Record<string,string>, baseUrl: string) {
  const nodes: any[] = workflow.nodes ?? []
  const edges: any[] = workflow.edges ?? []

  // Find trigger node
  const triggerNode = nodes.find((n: any) => n.type === 'trigger')
  if (!triggerNode) return

  // Traverse the graph from trigger
  await executeNode(supabase, run, workflow, nodes, edges, triggerNode.id, context, baseUrl)
}

async function executeNode(
  supabase: any, run: any, workflow: any,
  nodes: any[], edges: any[],
  nodeId: string, context: Record<string,string>, baseUrl: string,
  depth = 0
): Promise<void> {
  if (depth > 50) return // prevent infinite loops

  const node = nodes.find((n: any) => n.id === nodeId)
  if (!node) return

  const { data: step } = await supabase.from('workflow_run_steps').insert({
    run_id: run.id,
    node_id: nodeId,
    node_type: node.type,
    status: 'running',
    input_data: context,
    started_at: new Date().toISOString(),
  }).select().single()

  let result: any = {}
  let success = true
  let shouldContinue = true
  let nextBranch: 'true' | 'false' | null = null

  try {
    switch (node.type) {
      case 'trigger':
        result = { triggered: true }
        break

      case 'delay': {
        const days = node.config.days ?? 0
        const hours = node.config.hours ?? 0
        const ms = (days * 86400 + hours * 3600) * 1000
        const scheduledAt = new Date(Date.now() + ms)
        // For delays, we schedule future steps rather than blocking
        const nextEdge = edges.find((e: any) => e.from === nodeId)
        if (nextEdge && ms > 0) {
          // Schedule the next node as a deferred execution
          await supabase.from('workflow_run_steps').insert({
            run_id: run.id,
            node_id: nextEdge.to,
            node_type: nodes.find((n: any) => n.id === nextEdge.to)?.type ?? 'unknown',
            status: 'waiting',
            scheduled_at: scheduledAt.toISOString(),
            input_data: context,
          })
          shouldContinue = false // Will resume when cron picks up waiting steps
        }
        result = { scheduled_at: scheduledAt.toISOString() }
        break
      }

      case 'email': {
        if (context.email && node.config.body) {
          const subject = interpolate(node.config.subject ?? 'Message de votre clinique', context)
          const body = interpolate(node.config.body, context)
          const res = await fetch(`${baseUrl}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: run.patient_id, subject, body }),
          })
          const data = await res.json()
          success = data.success
          result = data
        }
        break
      }

      case 'whatsapp': {
        if (context.phone && node.config.body) {
          const body = interpolate(node.config.body, context)
          const twilioSid = process.env.TWILIO_ACCOUNT_SID
          const twilioToken = process.env.TWILIO_AUTH_TOKEN
          const twilioFrom = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'

          if (twilioSid && twilioToken && !twilioSid.includes('your_')) {
            let phone = context.phone.replace(/\s/g, '')
            if (!phone.startsWith('+')) phone = '+33' + phone.replace(/^0/, '')
            const formBody = new URLSearchParams({ From: twilioFrom, To: `whatsapp:${phone}`, Body: body })
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` },
              body: formBody,
            })
            success = res.ok
          } else {
            // Demo mode
            success = true
            result = { simulated: true, message: body }
          }
        }
        break
      }

      case 'generate_pdf': {
        if (node.config.template_id) {
          const res = await fetch(`${baseUrl}/api/documents/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_id: node.config.template_id, patient_id: run.patient_id }),
          })
          const data = await res.json()
          success = data.success
          result = data
          if (data.document) context.generated_document_id = data.document.id
        }
        break
      }

      case 'yousign': {
        const docId = context.generated_document_id
        if (docId) {
          const res = await fetch(`${baseUrl}/api/documents/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id: docId, signer_email: context.email }),
          })
          result = await res.json()
          success = result.success
        }
        break
      }

      case 'webhook': {
        if (node.config.url) {
          const payload = node.config.payload
            ? JSON.parse(interpolate(node.config.payload, context))
            : { event: 'workflow_step', ...context }
          const res = await fetch(node.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-ClinicFlow-Event': 'workflow_step' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000),
          })
          success = res.ok
          result = { status: res.status }
        }
        break
      }

      case 'slack': {
        if (node.config.webhook_url) {
          const message = interpolate(node.config.message ?? '', context)
          const res = await fetch(node.config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
          })
          success = res.ok
        }
        break
      }

      case 'condition': {
        const fieldValue = context[node.config.field ?? ''] ?? ''
        const expected   = node.config.value ?? ''
        const operator   = node.config.operator ?? 'equals'
        let condResult = false
        switch (operator) {
          case 'equals':     condResult = fieldValue === expected; break
          case 'not_equals': condResult = fieldValue !== expected; break
          case 'exists':     condResult = !!fieldValue; break
          case 'not_exists': condResult = !fieldValue; break
          case 'contains':   condResult = fieldValue.includes(expected); break
        }
        nextBranch = condResult ? 'true' : 'false'
        result = { condition_result: condResult, field: node.config.field, value: fieldValue }
        break
      }

      case 'send_intake_form': {
        // Create intake form if doesn't exist
        const { data: existing } = await supabase.from('patient_intake_forms')
          .select('token').eq('patient_id', run.patient_id).eq('status', 'pending').maybeSingle()
        if (!existing) {
          const { data: newForm } = await supabase.from('patient_intake_forms').insert({
            clinic_id: run.clinic_id,
            patient_id: run.patient_id,
            first_name: context.first_name,
            last_name: context.last_name,
            email: context.email,
          }).select('token').single()
          if (newForm) context.intake_link = `${baseUrl}/intake/${newForm.token}`
        } else {
          context.intake_link = `${baseUrl}/intake/${existing.token}`
        }
        result = { intake_link: context.intake_link }
        break
      }

      case 'notify_team': {
        await supabase.from('automation_logs').insert({
          clinic_id: run.clinic_id,
          patient_id: run.patient_id,
          action: 'team_notification',
          channel: 'internal',
          status: 'success',
          metadata: { message: interpolate(node.config.message ?? 'Action requise pour {{patient_name}}', context), workflow: workflow.name },
        })
        result = { notified: true }
        break
      }
    }
  } catch (err: any) {
    success = false
    result = { error: err.message }
  }

  // Update step status
  await supabase.from('workflow_run_steps').update({
    status: success ? 'completed' : 'failed',
    output_data: result,
    completed_at: new Date().toISOString(),
    error: success ? null : result.error,
  }).eq('id', step?.id)

  if (!shouldContinue) return

  // Find next nodes
  const nextEdges = edges.filter((e: any) => {
    if (e.from !== nodeId) return false
    if (nextBranch) return e.branch === nextBranch
    return true
  })

  for (const edge of nextEdges) {
    await executeNode(supabase, run, workflow, nodes, edges, edge.to, { ...context }, baseUrl, depth + 1)
  }
}
