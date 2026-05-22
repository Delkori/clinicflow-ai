import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { transcription, clinic_id } = await request.json()
    if (!transcription) return NextResponse.json({ error: 'No transcription' }, { status: 400 })

    let apiKey = process.env.OPENAI_API_KEY
    let model = 'gpt-4o'
    if (clinic_id) {
      const { data } = await getSupabase().from('clinic_integrations').select('config').eq('clinic_id', clinic_id).eq('provider', 'openai').eq('is_active', true).single()
      if (data?.config?.api_key) apiKey = data.config.api_key
      if (data?.config?.model) model = data.config.model
    }

    if (!apiKey) return NextResponse.json({ error: 'Clé OpenAI non configurée.' }, { status: 400 })

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0.2,
        messages: [
          { role: 'system', content: 'Tu es un assistant médical. Analyse la transcription et retourne UNIQUEMENT un JSON avec : motif_consultation, antecedents, examen_clinique, plan_traitement, summary, notes, recommandations.' },
          { role: 'user', content: transcription },
        ],
      }),
    })
    const result = await res.json()
    if (!res.ok) return NextResponse.json({ error: result.error?.message }, { status: 400 })
    let parsed: any = {}
    try { parsed = JSON.parse(result.choices[0].message.content) } catch { parsed = { summary: result.choices[0].message.content } }
    return NextResponse.json({ data: parsed })
  } catch (error) {
    return NextResponse.json({ error: 'Structuring failed' }, { status: 500 })
  }
}
