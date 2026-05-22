import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    const clinicId = formData.get('clinic_id') as string | null
    if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

    let apiKey = process.env.OPENAI_API_KEY
    if (clinicId) {
      const { data } = await getSupabase().from('clinic_integrations').select('config').eq('clinic_id', clinicId).eq('provider', 'openai').eq('is_active', true).single()
      if (data?.config?.api_key) apiKey = data.config.api_key
    }

    if (!apiKey) return NextResponse.json({ error: 'Clé OpenAI non configurée. Allez dans Paramètres → Intégrations → OpenAI.' }, { status: 400 })

    const openaiForm = new FormData()
    openaiForm.append('file', audio, 'audio.webm')
    openaiForm.append('model', 'whisper-1')
    openaiForm.append('language', 'fr')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
    })
    const result = await res.json()
    if (!res.ok) return NextResponse.json({ error: result.error?.message || 'Whisper error' }, { status: 400 })
    return NextResponse.json({ transcription: result.text })
  } catch (error) {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
