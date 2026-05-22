import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Tu es un assistant médical spécialisé en médecine esthétique.
À partir d'une transcription de consultation médicale, extrais et structure les informations en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks.

Format de sortie :
{
  "motif_consultation": "...",
  "mode_de_vie": "...",
  "diagnostic": "...",
  "zone_donneuse": "...",
  "plan_de_traitement": "...",
  "antecedents": "...",
  "medicaments": "...",
  "allergies": "...",
  "notes": "..."
}

Si une information n'est pas mentionnée, mets null. Ne devine pas.`

export async function POST(request: NextRequest) {
  try {
    const { transcription, treatment } = await request.json()
    if (!transcription) return NextResponse.json({ error: 'No transcription' }, { status: 400 })

    const userPrompt = `Traitement concerné : ${treatment ?? 'Non spécifié'}

Transcription de la consultation :
${transcription}

Extrais les données médicales structurées.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'GPT failed' }, { status: 500 })
    }

    const data = await response.json()
    const rawText = data.choices[0].message.content

    let structured: Record<string, string | null> = {}
    try {
      structured = JSON.parse(rawText)
      // Remove null values
      Object.keys(structured).forEach(k => { if (structured[k] === null) delete structured[k] })
    } catch {
      structured = { notes: rawText }
    }

    return NextResponse.json({ structured })
  } catch (error) {
    console.error('Structuration error:', error)
    return NextResponse.json({ error: 'Structuration failed' }, { status: 500 })
  }
}
