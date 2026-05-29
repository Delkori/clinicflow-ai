import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== 'clinicflow-setup-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Créer user via signUp (déclenche le trigger proprement)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'assaf@theclinic.fr',
    password: 'TheClinic2026!',
    options: {
      data: {
        full_name: 'Dr. Assaf Bendavid',
        clinic_name: 'The Clinic',
        role: 'medecin',
      }
    }
  })

  if (authError && !authError.message.includes('already registered')) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // 2. Récupérer la clinique créée
  const userId = authData?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'User creation failed or already exists', hint: 'Check auth.users' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('clinic_id').eq('id', userId).single()

  const clinicId = profile?.clinic_id
  if (!clinicId) {
    return NextResponse.json({ error: 'Profile/clinic not found' }, { status: 500 })
  }

  // 3. Compléter les données
  await supabase.from('clinics').update({ name: 'The Clinic' }).eq('id', clinicId)

  await supabase.from('subscriptions').upsert({
    clinic_id: clinicId, plan: 'pro', status: 'active',
    trial_ends_at: null,
    current_period_end: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
  }, { onConflict: 'clinic_id' })

  await supabase.from('booking_settings').upsert({
    clinic_id: clinicId, slug: 'the-clinic-capillaire', is_active: true,
    title: 'The Clinic — Greffe Capillaire',
    description: 'Prenez rendez-vous avec Dr. Assaf Bendavid, spécialiste en greffe capillaire FUE et DHI.'
  }, { onConflict: 'clinic_id' })

  await supabase.from('onboarding_progress').upsert({
    clinic_id: clinicId,
    completed_steps: ['clinic','treatment','workflow','booking'],
    is_completed: true
  }, { onConflict: 'clinic_id' })

  // 4. Traitements
  const treatments = [
    { name: 'Greffe FUE', color: '#1D4ED8', description: 'Follicular Unit Extraction — sans cicatrice linéaire' },
    { name: 'Greffe DHI (Choi Pen)', color: '#7C3AED', description: 'Direct Hair Implantation — implantation directe' },
    { name: 'Greffe Barbe & Moustache', color: '#0891B2', description: 'FUE barbe et moustache' },
    { name: 'Greffe Sourcils', color: '#059669', description: 'Restauration et densification des sourcils' },
    { name: 'PRP Capillaire', color: '#D97706', description: 'Plasma Riche en Plaquettes — stimulation repousse' },
    { name: 'Mésothérapie Capillaire', color: '#EC4899', description: 'Injections nutritives capillaires' },
    { name: 'Consultation & Bilan', color: '#475569', description: 'Diagnostic trichologique complet' },
  ]
  for (const t of treatments) {
    await supabase.from('treatments').insert({ clinic_id: clinicId, ...t })
  }

  // 5. Patients exemple
  const patients = [
    { first_name: 'Thomas',    last_name: 'Moreau',   email: 'thomas.moreau@gmail.com',  phone: '+33612345678', source: 'direct',   notes: 'Hamilton IV — candidat FUE 2500 greffons' },
    { first_name: 'Karim',     last_name: 'Benzara',  email: 'karim.benzara@hotmail.fr', phone: '+33623456789', source: 'doctolib', notes: 'Intéressé greffe barbe + sourcils' },
    { first_name: 'Julien',    last_name: 'Marchand', email: 'j.marchand@outlook.com',   phone: '+33634567890', source: 'direct',   notes: 'Suivi PRP séance 3/6' },
    { first_name: 'Alexandre', last_name: 'Dubois',   email: 'alex.dubois@gmail.com',    phone: '+33645678901', source: 'instagram','notes': 'Hamilton VI — greffe FUE planning' },
    { first_name: 'Mehdi',     last_name: 'Rachidi',  email: 'mehdi.rachidi@gmail.com',  phone: '+33656789012', source: 'doctolib', notes: 'Post-op J+45 greffe DHI 1800 greffons' },
  ]
  for (const p of patients) {
    await supabase.from('patients').insert({ clinic_id: clinicId, ...p })
  }

  // 6. Workflow FUE
  await supabase.from('workflow_definitions').insert({
    clinic_id: clinicId,
    name: 'Parcours Greffe FUE — The Clinic',
    description: 'De la consultation au suivi 1 an — protocole complet The Clinic',
    trigger_type: 'consultation_created',
    is_active: true,
    nodes: [
      {id:'trigger',type:'trigger',label:'Consultation FUE',icon:'⚡',x:60,y:220,config:{}},
      {id:'intake',type:'send_intake_form',label:'Formulaire anamnèse',icon:'📋',x:260,y:220,config:{}},
      {id:'wa_accueil',type:'whatsapp',label:'WA bienvenue',icon:'💬',x:460,y:220,config:{body:'Bonjour {{first_name}} ! Bienvenue chez The Clinic 💈 Complétez votre dossier : {{intake_link}}'}},
      {id:'delay_48h',type:'delay',label:'48h',icon:'⏰',x:660,y:220,config:{hours:48}},
      {id:'check_intake',type:'condition',label:'Dossier complet ?',icon:'🔀',x:860,y:220,config:{field:'intake_status',operator:'equals',value:'completed'}},
      {id:'relance',type:'whatsapp',label:'Relance dossier',icon:'💬',x:1060,y:340,config:{body:'Bonjour {{first_name}}, dossier en attente : {{intake_link}}'}},
      {id:'email_confirmation',type:'email',label:'Email confirmation',icon:'📧',x:1060,y:120,config:{subject:'Dossier complet — The Clinic',body:'Bonjour {{first_name}},\n\nVotre dossier est complet. Instructions pré-op à J-7.\n\nDr. Bendavid — The Clinic'}},
      {id:'delay_preop',type:'delay',label:'J-7',icon:'⏰',x:1280,y:120,config:{days:7}},
      {id:'email_preop',type:'email',label:'Instructions pré-op',icon:'📧',x:1480,y:120,config:{subject:'Instructions pré-op — The Clinic',body:'Bonjour {{first_name}},\n\n⚠️ OBLIGATOIRE :\n🚫 Arrêter Minoxidil 2 semaines\n🚫 Pas alcool 48h\n🚫 Pas aspirine 10j\n✅ Cheveux propres le jour J\n✅ Vêtements boutonnés\n✅ Accompagnant prévu\n\nDr. Assaf Bendavid — The Clinic'}},
      {id:'wa_veille',type:'whatsapp',label:'Rappel veille',icon:'💬',x:1680,y:120,config:{body:'Bonjour {{first_name}} ! Greffe DEMAIN The Clinic 💈 Cheveux propres, vêtements boutonnés. À demain !'}},
      {id:'delay_j1',type:'delay',label:'J+1',icon:'⏰',x:1880,y:120,config:{days:1}},
      {id:'wa_j1',type:'whatsapp',label:'Suivi J+1',icon:'💬',x:2080,y:120,config:{body:'Bonjour {{first_name}}, comment vous sentez-vous ? Rougeurs normales J+1. Continuez les antibiotiques 🙏'}},
      {id:'delay_j30',type:'delay',label:'J+30',icon:'⏰',x:2280,y:120,config:{days:29}},
      {id:'wa_j30',type:'whatsapp',label:'Suivi J+30',icon:'💬',x:2480,y:120,config:{body:'Bonjour {{first_name}} ! 1 mois après votre greffe 📸 Shock loss = NORMAL. Repousse dans 3-4 mois. Envoyez photos !'}},
      {id:'delay_j90',type:'delay',label:'J+90',icon:'⏰',x:2680,y:120,config:{days:60}},
      {id:'email_j90',type:'email',label:'3 mois',icon:'📧',x:2880,y:120,config:{subject:'3 mois — repousses en cours ! — The Clinic',body:'Bonjour {{first_name}},\n\n3 mois après votre greffe FUE, les repousses commencent !\nRésultat final à 12 mois.\n\nDr. Bendavid — The Clinic'}},
      {id:'delay_1an',type:'delay',label:'1 an',icon:'⏰',x:3080,y:120,config:{days:270}},
      {id:'email_1an',type:'email',label:'1 an — résultats',icon:'📧',x:3280,y:120,config:{subject:'🎉 1 an — résultats définitifs ! — The Clinic',body:'Bonjour {{first_name}},\n\n1 an après votre greffe — résultat définitif !\nVenez pour votre bilan photos avec Dr. Bendavid.\n\nUn avis Google nous ferait très plaisir ❤️\n\nThe Clinic'}},
    ],
    edges: [
      {from:'trigger',to:'intake'},{from:'intake',to:'wa_accueil'},{from:'wa_accueil',to:'delay_48h'},
      {from:'delay_48h',to:'check_intake'},{from:'check_intake',to:'email_confirmation',branch:'true'},
      {from:'check_intake',to:'relance',branch:'false'},{from:'email_confirmation',to:'delay_preop'},
      {from:'delay_preop',to:'email_preop'},{from:'email_preop',to:'wa_veille'},
      {from:'wa_veille',to:'delay_j1'},{from:'delay_j1',to:'wa_j1'},{from:'wa_j1',to:'delay_j30'},
      {from:'delay_j30',to:'wa_j30'},{from:'wa_j30',to:'delay_j90'},{from:'delay_j90',to:'email_j90'},
      {from:'email_j90',to:'delay_1an'},{from:'delay_1an',to:'email_1an'}
    ],
    run_count: 0,
  })

  // 7. Workflow PRP
  await supabase.from('workflow_definitions').insert({
    clinic_id: clinicId,
    name: 'Protocole PRP Capillaire — 6 séances',
    description: 'Suivi patient sur 3 mois — The Clinic',
    trigger_type: 'consultation_created',
    is_active: true,
    nodes: [
      {id:'trigger',type:'trigger',label:'Consultation PRP',icon:'⚡',x:60,y:200,config:{}},
      {id:'email_bienvenue',type:'email',label:'Email protocole',icon:'📧',x:260,y:200,config:{subject:'Protocole PRP 6 séances — The Clinic',body:'Bonjour {{first_name}},\n\nVotre protocole PRP : 6 séances sur 3 mois.\nPrép. : pas anti-inflammatoires 5j avant chaque séance.\n\nThe Clinic'}},
      {id:'d_s2',type:'delay',label:'J+14',icon:'⏰',x:460,y:200,config:{days:14}},
      {id:'wa_s2',type:'whatsapp',label:'Rappel S2',icon:'💬',x:660,y:200,config:{body:'Bonjour {{first_name}} ! Séance 2/6 PRP The Clinic 💉 Pas anti-inflam depuis 5j.'}},
      {id:'d_s3',type:'delay',label:'J+28',icon:'⏰',x:860,y:200,config:{days:14}},
      {id:'wa_s3',type:'whatsapp',label:'Rappel S3',icon:'💬',x:1060,y:200,config:{body:'Séance 3/6 — à mi-parcours, moins de chute déjà observable !'}},
      {id:'d_s4',type:'delay',label:'J+42',icon:'⏰',x:1260,y:200,config:{days:14}},
      {id:'wa_s4',type:'whatsapp',label:'Rappel S4',icon:'💬',x:1460,y:200,config:{body:'Séance 4/6 The Clinic. Réduction significative de la chute 💪'}},
      {id:'d_s5',type:'delay',label:'J+56',icon:'⏰',x:1660,y:200,config:{days:14}},
      {id:'wa_s5',type:'whatsapp',label:'Rappel S5',icon:'💬',x:1860,y:200,config:{body:'Avant-dernière séance PRP. Dr. Bendavid évalue les progrès.'}},
      {id:'d_s6',type:'delay',label:'J+70',icon:'⏰',x:2060,y:200,config:{days:14}},
      {id:'wa_s6',type:'whatsapp',label:'Séance finale',icon:'💬',x:2260,y:200,config:{body:'Dernière séance PRP The Clinic 🏆 Bilan final avec Dr. Bendavid !'}},
      {id:'d_bilan',type:'delay',label:'Bilan J+90',icon:'⏰',x:2460,y:200,config:{days:20}},
      {id:'email_bilan',type:'email',label:'Bilan final',icon:'📧',x:2660,y:200,config:{subject:'Protocole PRP terminé — The Clinic',body:'Bonjour {{first_name}},\n\nProtocole PRP terminé ! Maintenance : 1 séance tous les 3-6 mois.\n\nDr. Bendavid — The Clinic'}},
    ],
    edges: [
      {from:'trigger',to:'email_bienvenue'},{from:'email_bienvenue',to:'d_s2'},{from:'d_s2',to:'wa_s2'},
      {from:'wa_s2',to:'d_s3'},{from:'d_s3',to:'wa_s3'},{from:'wa_s3',to:'d_s4'},{from:'d_s4',to:'wa_s4'},
      {from:'wa_s4',to:'d_s5'},{from:'d_s5',to:'wa_s5'},{from:'wa_s5',to:'d_s6'},{from:'d_s6',to:'wa_s6'},
      {from:'wa_s6',to:'d_bilan'},{from:'d_bilan',to:'email_bilan'}
    ],
    run_count: 0,
  })

  return NextResponse.json({
    success: true,
    clinic_id: clinicId,
    message: 'The Clinic créée avec succès pour Dr. Assaf Bendavid',
    login: { email: 'assaf@theclinic.fr', password: 'TheClinic2026!' }
  })
}
