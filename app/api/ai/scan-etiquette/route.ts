import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { image, type } = await request.json()
  if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ parsed: null, error: 'No AI key configured' })
  }

  try {
    // Use Claude vision to extract label info
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Tu es un assistant médical. Analyse cette étiquette de produit injectable médical (${type === 'acide_hyaluronique' ? 'acide hyaluronique' : type === 'toxine_botulinique' ? 'toxine botulinique' : 'injectable médical'}) et extrais les informations.

Réponds UNIQUEMENT en JSON valide avec ces champs (null si non visible) :
{
  "nom_produit": "nom commercial exact",
  "marque": "fabricant/laboratoire",
  "reference": "référence produit",
  "numero_lot": "numéro de lot (LOT ou BATCH)",
  "date_expiration": "YYYY-MM-DD si visible",
  "concentration": "concentration ex: 24mg/mL",
  "volume_ml": "volume en mL (chiffre uniquement)"
}`
            }
          ]
        }]
      })
    })

    if (!res.ok) return NextResponse.json({ parsed: null })

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''

    // Parse JSON from response
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ parsed: null })

    const parsed = JSON.parse(match[0])
    return NextResponse.json({ parsed })

  } catch (e) {
    return NextResponse.json({ parsed: null, error: String(e) })
  }
}
