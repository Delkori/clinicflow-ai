import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { consultation_id } = await request.json()
    const supabase = getSupabase()

    const { data: consult } = await supabase
      .from('consultations')
      .select('*, patient:patients(first_name, last_name, date_of_birth, email), clinic:clinics(name)')
      .eq('id', consultation_id)
      .single()

    if (!consult) return NextResponse.json({ error: 'Consultation introuvable' }, { status: 404 })

    const openaiKey = process.env.OPENAI_API_KEY
    const structured = consult.structured_data ?? {}
    const patientName = `${consult.patient?.first_name} ${consult.patient?.last_name}`
    const clinicName = (consult as any).clinic?.name ?? 'Clinique'
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    if (!openaiKey || openaiKey.includes('your_')) {
      // Demo mode - return a sample report
      const demoReport = generateDemoReport(patientName, clinicName, today, structured, consult.acte_type)
      return NextResponse.json({ success: true, report: demoReport, simulated: true })
    }

    const prompt = `Tu es un médecin spécialisé en médecine esthétique. Génère un compte-rendu médical professionnel et complet en français à partir des données suivantes.

PATIENT : ${patientName}
DATE : ${today}
CLINIQUE : ${clinicName}
ACTE : ${consult.acte_type ?? 'Consultation'}

DONNÉES STRUCTURÉES :
${JSON.stringify(structured, null, 2)}

${consult.transcription ? `TRANSCRIPTION BRUTE :\n${consult.transcription}` : ''}

CONSIGNES :
- Rédige un compte-rendu médical professionnel en prose
- Structure : Introduction → Anamnèse → Examen clinique → Diagnostic → Plan de traitement → Instructions post-acte
- Utilise un vocabulaire médical approprié à la médecine esthétique
- Mentionne explicitement les scores cliniques si présents (Hamilton, Glogau, GAIS...)
- Sois précis sur les zones traitées, produits utilisés, volumes et dosages
- Termine par une note de suivi
- Format HTML avec balises <h3>, <p>, <ul>, <strong>
- Ne génère AUCUNE donnée inventée, seulement ce qui est dans les données fournies`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    })

    const data = await res.json()
    const report = data.choices?.[0]?.message?.content ?? ''

    // Save report to consultation structured_data
    await supabase.from('consultations').update({
      structured_data: { ...structured, compte_rendu_ia: report },
    }).eq('id', consultation_id)

    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function generateDemoReport(patient: string, clinic: string, date: string, data: any, acte: string): string {
  return `<h3>Compte-rendu de consultation</h3>
<p><strong>Patient :</strong> ${patient} | <strong>Date :</strong> ${date} | <strong>Clinique :</strong> ${clinic}</p>
<p><strong>Acte :</strong> ${acte ?? 'Consultation médicale esthétique'}</p>

<h3>Motif de consultation</h3>
<p>${data.motif_consultation ?? 'Le patient consulte pour une prise en charge esthétique.'}</p>

${data.antecedents ? `<h3>Antécédents</h3><p>${data.antecedents}</p>` : ''}

${data.diagnostic ? `<h3>Examen clinique et diagnostic</h3><p>${data.diagnostic}</p>` : ''}

${data.plan_de_traitement ? `<h3>Plan de traitement proposé</h3><p>${data.plan_de_traitement}</p>` : ''}

<h3>Conclusion</h3>
<p>Le patient a été informé des risques, bénéfices et alternatives thérapeutiques. Le consentement éclairé a été recueilli. Un suivi sera organisé selon le protocole établi.</p>

<p style="font-size:11px;color:#94A3B8;margin-top:16px"><em>Document généré par ClinicFlow AI — ${clinic} — ${date}</em></p>`
}
