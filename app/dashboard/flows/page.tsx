'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TRIGGER_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  consultation_created: { label:'Nouvelle consultation', icon:'✦', color:'#7C3AED', bg:'#F5F3FF' },
  patient_created:      { label:'Nouveau patient',       icon:'◎', color:'#0596DE', bg:'#EFF6FF' },
  appointment_created:  { label:'RDV créé',              icon:'◫', color:'#059669', bg:'#ECFDF5' },
  invoice_paid:         { label:'Facture payée',         icon:'💰', color:'#059669', bg:'#ECFDF5' },
  manual:               { label:'Déclenchement manuel',  icon:'▶', color:'#6B7280', bg:'#F3F4F6' },
  webhook:              { label:'Webhook entrant',        icon:'⚡', color:'#D97706', bg:'#FFFBEB' },
  scheduled:            { label:'Planifié',              icon:'🕐', color:'#0891B2', bg:'#ECFEFF' },
}

// ─────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE TEMPLATES (style Power Automate)
// ─────────────────────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  { id: 'all',        label: 'Tous',              icon: '⚡' },
  { id: 'suivi',      label: 'Suivi patient',     icon: '🩺' },
  { id: 'injectables',label: 'Injectables',       icon: '💉' },
  { id: 'admin',      label: 'Administratif',     icon: '💼' },
  { id: 'fidelite',   label: 'Fidélité',          icon: '🎁' },
  { id: 'capillaire', label: 'Capillaire',        icon: '💈' },
]

const WORKFLOW_TEMPLATES = [
  // ── Suivi patient ──────────────────────────────────────────────
  {
    id: 'tpl_post_consultation',
    categorie: 'suivi',
    nom: 'Suivi post-consultation',
    description: 'Message de bienvenue 24h après, compte-rendu J+3, demande de satisfaction J+7',
    icon: '🩺',
    color: '#7C3AED',
    trigger: 'consultation_created',
    nb_etapes: 5,
    tags: ['WhatsApp', 'Email', 'Délai'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation créée',icon:'⚡',x:60,y:200,config:{}},
      {id:'d1',type:'delay',label:'Attendre 24h',icon:'⏰',x:240,y:200,config:{hours:24}},
      {id:'wa1',type:'whatsapp',label:'WA lendemain',icon:'💬',x:420,y:200,config:{body:'Bonjour {{first_name}} 😊 Comment vous sentez-vous après votre consultation d\'hier ? N\'hésitez pas si vous avez des questions.'}},
      {id:'d2',type:'delay',label:'J+3',icon:'⏰',x:600,y:200,config:{days:2}},
      {id:'e1',type:'email',label:'Compte-rendu J+3',icon:'📧',x:780,y:200,config:{subject:'Votre compte-rendu de consultation',body:'Bonjour {{first_name}},\n\nSuite à votre consultation, voici le compte-rendu de votre soin.\n\nVos prochaines étapes :\n• Suivez les instructions post-soin\n• Contactez-nous si nécessaire\n\nCordialement,\n{{clinic_name}}'}},
      {id:'d3',type:'delay',label:'J+7',icon:'⏰',x:960,y:200,config:{days:4}},
      {id:'wa2',type:'whatsapp',label:'Satisfaction J+7',icon:'💬',x:1140,y:200,config:{body:'Bonjour {{first_name}} ! Une semaine après votre consultation, êtes-vous satisfait(e) de votre soin ? Votre avis nous est précieux 🙏'}},
    ],
    edges:[
      {from:'t',to:'d1'},{from:'d1',to:'wa1'},{from:'wa1',to:'d2'},
      {from:'d2',to:'e1'},{from:'e1',to:'d3'},{from:'d3',to:'wa2'},
    ],
  },
  {
    id: 'tpl_anniversaire_traitement',
    categorie: 'suivi',
    nom: 'Rappel anniversaire traitement',
    description: 'Relance automatique 3, 6 et 12 mois après un soin pour proposer une séance de suivi',
    icon: '📅',
    color: '#059669',
    trigger: 'consultation_created',
    nb_etapes: 6,
    tags: ['Email', 'WhatsApp', 'Long terme'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation créée',icon:'⚡',x:60,y:200,config:{}},
      {id:'d3m',type:'delay',label:'3 mois',icon:'⏰',x:260,y:200,config:{days:90}},
      {id:'wa3m',type:'whatsapp',label:'Rappel 3 mois',icon:'💬',x:440,y:200,config:{body:'Bonjour {{first_name}} ! 3 mois se sont écoulés depuis votre soin chez {{clinic_name}} 🌟 C\'est le bon moment pour un bilan. Souhaitez-vous prendre RDV ?'}},
      {id:'d6m',type:'delay',label:'6 mois',icon:'⏰',x:640,y:200,config:{days:90}},
      {id:'e6m',type:'email',label:'Bilan 6 mois',icon:'📧',x:820,y:200,config:{subject:'Bilan 6 mois — {{clinic_name}}',body:'Bonjour {{first_name}},\n\n6 mois après votre dernier soin, c\'est le moment idéal pour un bilan.\n\nRéservez votre consultation de suivi :\n{{booking_link}}\n\n{{clinic_name}}'}},
      {id:'d12m',type:'delay',label:'1 an',icon:'⏰',x:1020,y:200,config:{days:180}},
      {id:'wa12m',type:'whatsapp',label:'Anniversaire 1 an',icon:'💬',x:1200,y:200,config:{body:'Bonjour {{first_name}} ! 🎉 Un an après votre soin chez {{clinic_name}} — résultats définitifs ? On adorait vous revoir pour un bilan annuel.'}},
    ],
    edges:[
      {from:'t',to:'d3m'},{from:'d3m',to:'wa3m'},{from:'wa3m',to:'d6m'},
      {from:'d6m',to:'e6m'},{from:'e6m',to:'d12m'},{from:'d12m',to:'wa12m'},
    ],
  },
  {
    id: 'tpl_relance_inactif',
    categorie: 'suivi',
    nom: 'Réactivation patient inactif',
    description: 'Relance automatique si aucune consultation depuis 90 jours — offre spéciale réactivation',
    icon: '🔄',
    color: '#D97706',
    trigger: 'scheduled',
    nb_etapes: 3,
    tags: ['Email', 'WhatsApp', 'Planifié'],
    nodes: [
      {id:'t',type:'trigger',label:'Planifié (quotidien)',icon:'🕐',x:60,y:200,config:{cron:'0 9 * * *'}},
      {id:'c1',type:'condition',label:'Inactif > 90 jours ?',icon:'🔀',x:260,y:200,config:{field:'days_since_last_consultation',operator:'greater_than',value:'90'}},
      {id:'e1',type:'email',label:'Email réactivation',icon:'📧',x:460,y:140,config:{subject:'Vous nous manquez, {{first_name}} 💙',body:'Bonjour {{first_name}},\n\nCela fait un moment que vous n\'êtes pas passé(e) chez {{clinic_name}}.\n\nPour fêter votre retour, bénéficiez de 10% sur votre prochain soin :\n{{booking_link}}\n\nOff valable 15 jours.\n\n{{clinic_name}}'}},
      {id:'wa1',type:'whatsapp',label:'WA réactivation',icon:'💬',x:460,y:280,config:{body:'Bonjour {{first_name}} ! Cela fait longtemps... 😊 Un petit soin chez {{clinic_name}} vous ferait du bien ? On a une offre spéciale pour vous : {{booking_link}}'}},
    ],
    edges:[
      {from:'t',to:'c1'},
      {from:'c1',to:'e1',branch:'true'},
      {from:'c1',to:'wa1',branch:'false'},
    ],
  },

  // ── Injectables ────────────────────────────────────────────────
  {
    id: 'tpl_botox_suivi',
    categorie: 'injectables',
    nom: 'Suivi Botox / Toxine',
    description: 'Protocole de suivi Botox : vérification J+15, rappel retouche J+14, relance à 4 mois',
    icon: '⚡',
    color: '#7C3AED',
    trigger: 'consultation_created',
    nb_etapes: 6,
    tags: ['WhatsApp', 'Email', 'Retouche'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation Botox',icon:'⚡',x:60,y:200,config:{}},
      {id:'d1',type:'delay',label:'J+1',icon:'⏰',x:240,y:200,config:{days:1}},
      {id:'wa1',type:'whatsapp',label:'Lendemain',icon:'💬',x:420,y:200,config:{body:'Bonjour {{first_name}} ! Comment vous sentez-vous après votre injection de Botox ? Des rougeurs légères sont normales les premières 24h 🙏'}},
      {id:'d2',type:'delay',label:'J+14 (retouche)',icon:'⏰',x:600,y:200,config:{days:13}},
      {id:'wa2',type:'whatsapp',label:'Rappel retouche J+14',icon:'💬',x:780,y:200,config:{body:'Bonjour {{first_name}} ! 2 semaines après votre Botox — le résultat est visible 💫 Si vous souhaitez une petite retouche d\'ajustement, c\'est le bon moment !'}},
      {id:'d3',type:'delay',label:'4 mois',icon:'⏰',x:960,y:200,config:{days:106}},
      {id:'e1',type:'email',label:'Rappel renouvellement',icon:'📧',x:1140,y:200,config:{subject:'C\'est l\'heure de renouveler votre Botox !',body:'Bonjour {{first_name}},\n\n4 mois après votre injection, les effets du Botox commencent à s\'estomper. C\'est le bon moment pour renouveler votre traitement !\n\nPrenez RDV ici :\n{{booking_link}}\n\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'d1'},{from:'d1',to:'wa1'},{from:'wa1',to:'d2'},
      {from:'d2',to:'wa2'},{from:'wa2',to:'d3'},{from:'d3',to:'e1'},
    ],
  },
  {
    id: 'tpl_ha_suivi',
    categorie: 'injectables',
    nom: 'Suivi Acide Hyaluronique',
    description: 'Suivi HA : vérification J+3, bilan J+14, rappel retouche, renouvellement à 12 mois',
    icon: '💧',
    color: '#0891B2',
    trigger: 'consultation_created',
    nb_etapes: 7,
    tags: ['WhatsApp', 'Email', 'Photos'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation HA',icon:'⚡',x:60,y:200,config:{}},
      {id:'wa0',type:'whatsapp',label:'Instructions post-op',icon:'💬',x:240,y:200,config:{body:'Bonjour {{first_name}} 💧 Suite à vos injections HA :\n✅ Pas de sport 48h\n✅ Pas de massage sur les zones traitées\n✅ Glace si gonflement\n❌ Pas de chaleur intense (sauna, hammam) 2 semaines\n\nQuestions ? Répondez à ce message !'}},
      {id:'d1',type:'delay',label:'J+3',icon:'⏰',x:420,y:200,config:{days:3}},
      {id:'wa1',type:'whatsapp',label:'Bilan J+3',icon:'💬',x:600,y:200,config:{body:'Bonjour {{first_name}} ! J+3 post-injection HA — le gonflement devrait être résorti. Comment vous sentez-vous ? Envoyez-nous une photo si vous souhaitez notre avis 📸'}},
      {id:'d2',type:'delay',label:'J+14',icon:'⏰',x:780,y:200,config:{days:11}},
      {id:'wa2',type:'whatsapp',label:'Bilan J+14',icon:'💬',x:960,y:200,config:{body:'Bonjour {{first_name}} ! 2 semaines après vos injections HA — le résultat est maintenant stabilisé ✨ Êtes-vous satisfait(e) ? Pensez à partager votre photo avant/après !'}},
      {id:'d3',type:'delay',label:'10 mois',icon:'⏰',x:1140,y:200,config:{days:270}},
      {id:'e1',type:'email',label:'Rappel renouvellement',icon:'📧',x:1320,y:200,config:{subject:'Renouvellement de vos injections HA',body:'Bonjour {{first_name}},\n\nL\'acide hyaluronique se résorbe naturellement. Pour maintenir vos résultats, nous vous recommandons de renouveler votre traitement prochainement.\n\n{{booking_link}}\n\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'wa0'},{from:'wa0',to:'d1'},{from:'d1',to:'wa1'},
      {from:'wa1',to:'d2'},{from:'d2',to:'wa2'},{from:'wa2',to:'d3'},{from:'d3',to:'e1'},
    ],
  },
  {
    id: 'tpl_prp_serie',
    categorie: 'injectables',
    nom: 'Protocole PRP — 3 séances',
    description: 'Suivi automatique d\'une série de 3 PRP : rappels + bilan entre chaque séance',
    icon: '🩸',
    color: '#DC2626',
    trigger: 'consultation_created',
    nb_etapes: 7,
    tags: ['WhatsApp', 'Rappels', 'Série'],
    nodes: [
      {id:'t',type:'trigger',label:'S1 — 1er PRP',icon:'⚡',x:60,y:200,config:{}},
      {id:'e1',type:'email',label:'Email protocole',icon:'📧',x:240,y:200,config:{subject:'Votre protocole PRP — 3 séances',body:'Bonjour {{first_name}},\n\nVoici votre protocole PRP :\n📅 3 séances espacées de 4 semaines\n⚠️ Ne pas prendre d\'anti-inflammatoires 5j avant chaque séance\n\n{{clinic_name}}'}},
      {id:'d1',type:'delay',label:'J+28 (S2)',icon:'⏰',x:440,y:200,config:{days:28}},
      {id:'wa1',type:'whatsapp',label:'Rappel S2',icon:'💬',x:620,y:200,config:{body:'Bonjour {{first_name}} ! C\'est l\'heure de votre 2ème séance PRP 💉 Rappel : pas d\'anti-inflammatoires depuis 5 jours. À bientôt !'}},
      {id:'d2',type:'delay',label:'J+56 (S3)',icon:'⏰',x:800,y:200,config:{days:28}},
      {id:'wa2',type:'whatsapp',label:'Rappel S3',icon:'💬',x:980,y:200,config:{body:'Bonjour {{first_name}} ! Dernière séance PRP demain 🏆 Le protocole sera complet. On verra les premiers résultats dans 4-6 semaines !'}},
      {id:'d3',type:'delay',label:'Bilan 3 mois',icon:'⏰',x:1160,y:200,config:{days:28}},
      {id:'wa3',type:'whatsapp',label:'Bilan final',icon:'💬',x:1340,y:200,config:{body:'Bonjour {{first_name}} ! 3 mois après votre protocole PRP — comment se porte votre peau/cuir chevelu ? Envoyez-nous une photo pour le bilan final 📸'}},
    ],
    edges:[
      {from:'t',to:'e1'},{from:'e1',to:'d1'},{from:'d1',to:'wa1'},
      {from:'wa1',to:'d2'},{from:'d2',to:'wa2'},{from:'wa2',to:'d3'},{from:'d3',to:'wa3'},
    ],
  },
  {
    id: 'tpl_mesotherapie',
    categorie: 'injectables',
    nom: 'Protocole Mésothérapie — 6 séances',
    description: 'Programme complet mésothérapie avec rappels toutes les 2 semaines sur 3 mois',
    icon: '✨',
    color: '#059669',
    trigger: 'consultation_created',
    nb_etapes: 8,
    tags: ['WhatsApp', 'Rappels', '3 mois'],
    nodes: [
      {id:'t',type:'trigger',label:'S1 Mésothérapie',icon:'⚡',x:60,y:200,config:{}},
      {id:'wa0',type:'whatsapp',label:'Instructions S1',icon:'💬',x:240,y:200,config:{body:'Bonjour {{first_name}} ! Suite à votre mésothérapie : pas de maquillage 24h, évitez la chaleur 48h. On se revoit dans 2 semaines 💫'}},
      {id:'d2',type:'delay',label:'S2 (J+14)',icon:'⏰',x:420,y:200,config:{days:14}},
      {id:'wa2',type:'whatsapp',label:'Rappel S2',icon:'💬',x:600,y:200,config:{body:'Séance 2/6 de mésothérapie chez {{clinic_name}} cette semaine 💉 Les premiers effets devraient être visibles !'}},
      {id:'d3',type:'delay',label:'S3 (J+28)',icon:'⏰',x:780,y:200,config:{days:14}},
      {id:'wa3',type:'whatsapp',label:'Mi-parcours S3',icon:'💬',x:960,y:200,config:{body:'Mi-parcours ! Séance 3/6 💪 On continue sur cette belle lancée !'}},
      {id:'d6',type:'delay',label:'S6 (J+70)',icon:'⏰',x:1140,y:200,config:{days:42}},
      {id:'wa6',type:'whatsapp',label:'Dernière séance',icon:'💬',x:1320,y:200,config:{body:'Dernière séance du protocole mésothérapie 🎉 Bilan final avec votre praticien !'}},
      {id:'d_bilan',type:'delay',label:'Bilan J+90',icon:'⏰',x:1500,y:200,config:{days:20}},
      {id:'e_bilan',type:'email',label:'Bilan 3 mois',icon:'📧',x:1680,y:200,config:{subject:'Bilan protocole mésothérapie',body:'Bonjour {{first_name}},\n\nVotre protocole de 6 séances est terminé ! Pour maintenir les résultats, une séance tous les 3 mois est recommandée.\n\n{{booking_link}}\n\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'wa0'},{from:'wa0',to:'d2'},{from:'d2',to:'wa2'},
      {from:'wa2',to:'d3'},{from:'d3',to:'wa3'},{from:'wa3',to:'d6'},
      {from:'d6',to:'wa6'},{from:'wa6',to:'d_bilan'},{from:'d_bilan',to:'e_bilan'},
    ],
  },

  // ── Administratif ──────────────────────────────────────────────
  {
    id: 'tpl_rappel_rdv',
    categorie: 'admin',
    nom: 'Rappel de rendez-vous',
    description: 'Double rappel automatique : email J-3 et WhatsApp J-1 avec instructions de préparation',
    icon: '📅',
    color: '#0596DE',
    trigger: 'appointment_created',
    nb_etapes: 4,
    tags: ['Email', 'WhatsApp', 'RDV'],
    nodes: [
      {id:'t',type:'trigger',label:'RDV créé',icon:'⚡',x:60,y:200,config:{}},
      {id:'e1',type:'email',label:'Confirmation email',icon:'📧',x:240,y:200,config:{subject:'✅ Votre RDV confirmé — {{clinic_name}}',body:'Bonjour {{first_name}},\n\nVotre rendez-vous est confirmé :\n📅 Date : {{appointment_date}}\n📍 Lieu : {{clinic_address}}\n\n💡 Pour préparer votre venue :\n• Venez le visage démaquillé\n• Prévoyez 15 min d\'avance\n\nÀ très bientôt !\n{{clinic_name}}'}},
      {id:'d1',type:'delay',label:'J-3',icon:'⏰',x:440,y:200,config:{days:-3}},
      {id:'e2',type:'email',label:'Rappel J-3',icon:'📧',x:620,y:200,config:{subject:'Rappel : votre RDV dans 3 jours',body:'Bonjour {{first_name}},\n\nRappel de votre rendez-vous dans 3 jours chez {{clinic_name}}.\n\nSi vous ne pouvez plus venir, merci de nous prévenir au plus tôt.\n\n{{clinic_name}}'}},
      {id:'d2',type:'delay',label:'J-1',icon:'⏰',x:800,y:200,config:{days:-1}},
      {id:'wa1',type:'whatsapp',label:'Rappel WhatsApp J-1',icon:'💬',x:980,y:200,config:{body:'Bonjour {{first_name}} ! Rappel de votre RDV DEMAIN chez {{clinic_name}} 📅 En cas d\'empêchement, contactez-nous rapidement. À demain !'}},
    ],
    edges:[
      {from:'t',to:'e1'},{from:'e1',to:'d1'},{from:'d1',to:'e2'},
      {from:'e2',to:'d2'},{from:'d2',to:'wa1'},
    ],
  },
  {
    id: 'tpl_nouveau_patient',
    categorie: 'admin',
    nom: 'Accueil nouveau patient',
    description: 'Parcours de bienvenue : email de bienvenue + formulaire anamnèse + rappel RDV',
    icon: '🌟',
    color: '#0596DE',
    trigger: 'patient_created',
    nb_etapes: 4,
    tags: ['Email', 'Formulaire', 'Bienvenue'],
    nodes: [
      {id:'t',type:'trigger',label:'Patient créé',icon:'⚡',x:60,y:200,config:{}},
      {id:'e1',type:'email',label:'Email bienvenue',icon:'📧',x:240,y:200,config:{subject:'Bienvenue chez {{clinic_name}} 👋',body:'Bonjour {{first_name}},\n\nBienvenue chez {{clinic_name}} ! Nous sommes ravis de vous accueillir.\n\nPour préparer au mieux votre consultation, merci de compléter votre questionnaire médical :\n{{intake_link}}\n\nÀ très bientôt,\n{{clinic_name}}'}},
      {id:'intake',type:'send_intake_form',label:'Envoyer formulaire',icon:'📋',x:420,y:200,config:{}},
      {id:'d1',type:'delay',label:'48h',icon:'⏰',x:600,y:200,config:{hours:48}},
      {id:'c1',type:'condition',label:'Formulaire complété ?',icon:'🔀',x:780,y:200,config:{field:'intake_status',operator:'equals',value:'completed'}},
      {id:'wa_ok',type:'whatsapp',label:'Dossier OK',icon:'💬',x:980,y:140,config:{body:'Bonjour {{first_name}} ! Votre dossier est complet, merci 🙏 Hâte de vous rencontrer chez {{clinic_name}} !'}},
      {id:'wa_relance',type:'whatsapp',label:'Relance formulaire',icon:'💬',x:980,y:280,config:{body:'Bonjour {{first_name}} ! Votre formulaire médical est en attente de complétion : {{intake_link}} Merci 🙏'}},
    ],
    edges:[
      {from:'t',to:'e1'},{from:'e1',to:'intake'},{from:'intake',to:'d1'},
      {from:'d1',to:'c1'},
      {from:'c1',to:'wa_ok',branch:'true'},
      {from:'c1',to:'wa_relance',branch:'false'},
    ],
  },
  {
    id: 'tpl_facture_paiement',
    categorie: 'admin',
    nom: 'Notification facture & paiement',
    description: 'Envoi automatique de la facture par email à la création, relance si non payée à J+7',
    icon: '💰',
    color: '#059669',
    trigger: 'invoice_paid',
    nb_etapes: 4,
    tags: ['Email', 'Facture', 'Relance'],
    nodes: [
      {id:'t',type:'trigger',label:'Facture créée',icon:'⚡',x:60,y:200,config:{}},
      {id:'e1',type:'email',label:'Envoi facture',icon:'📧',x:240,y:200,config:{subject:'Votre facture {{invoice_number}} — {{clinic_name}}',body:'Bonjour {{first_name}},\n\nVeuillez trouver votre facture {{invoice_number}} d\'un montant de {{invoice_amount}} € TTC.\n\n{{invoice_link}}\n\nCordialement,\n{{clinic_name}}'}},
      {id:'d1',type:'delay',label:'J+7',icon:'⏰',x:420,y:200,config:{days:7}},
      {id:'c1',type:'condition',label:'Facture payée ?',icon:'🔀',x:600,y:200,config:{field:'invoice_status',operator:'equals',value:'payee'}},
      {id:'wa_relance',type:'whatsapp',label:'Relance paiement',icon:'💬',x:800,y:280,config:{body:'Bonjour {{first_name}}, votre facture {{invoice_number}} de {{invoice_amount}} € est toujours en attente de règlement. Contactez-nous si besoin.'}},
      {id:'wa_merci',type:'whatsapp',label:'Remerciement',icon:'💬',x:800,y:140,config:{body:'Merci {{first_name}} pour votre règlement 🙏 À très bientôt chez {{clinic_name}} !'}},
    ],
    edges:[
      {from:'t',to:'e1'},{from:'e1',to:'d1'},{from:'d1',to:'c1'},
      {from:'c1',to:'wa_merci',branch:'true'},
      {from:'c1',to:'wa_relance',branch:'false'},
    ],
  },
  {
    id: 'tpl_demande_avis',
    categorie: 'admin',
    nom: 'Demande d\'avis Google',
    description: 'Envoi automatique d\'une demande d\'avis 48h après la consultation si patient satisfait',
    icon: '⭐',
    color: '#F59E0B',
    trigger: 'consultation_created',
    nb_etapes: 3,
    tags: ['WhatsApp', 'Email', 'Avis Google'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation terminée',icon:'⚡',x:60,y:200,config:{}},
      {id:'d1',type:'delay',label:'48h',icon:'⏰',x:240,y:200,config:{hours:48}},
      {id:'wa1',type:'whatsapp',label:'Demande avis',icon:'💬',x:420,y:200,config:{body:'Bonjour {{first_name}} 😊 Votre avis sur Google aide beaucoup d\'autres patients à nous trouver. Si vous êtes satisfait(e), 30 secondes suffisent :\n{{google_review_link}}\nMerci infiniment ! {{clinic_name}}'}},
      {id:'d2',type:'delay',label:'J+5 (non avis)',icon:'⏰',x:600,y:200,config:{days:3}},
      {id:'e1',type:'email',label:'Relance par email',icon:'📧',x:780,y:200,config:{subject:'Votre avis nous tient à cœur 🙏',body:'Bonjour {{first_name}},\n\nAvoir votre avis sur notre clinique nous aiderait énormément :\n{{google_review_link}}\n\nMerci de votre confiance !\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'d1'},{from:'d1',to:'wa1'},{from:'wa1',to:'d2'},{from:'d2',to:'e1'},
    ],
  },

  // ── Fidélité ────────────────────────────────────────────────────
  {
    id: 'tpl_bienvenue_fidelite',
    categorie: 'fidelite',
    nom: 'Bienvenue programme fidélité',
    description: 'Message de bienvenue avec points de bonus + présentation des avantages dès la 1ère facture',
    icon: '🎁',
    color: '#EC4899',
    trigger: 'invoice_paid',
    nb_etapes: 2,
    tags: ['WhatsApp', 'Email', 'Points'],
    nodes: [
      {id:'t',type:'trigger',label:'1ère facture payée',icon:'⚡',x:60,y:200,config:{}},
      {id:'wa1',type:'whatsapp',label:'Bienvenue fidélité',icon:'💬',x:240,y:200,config:{body:'🎉 Bienvenue dans le programme fidélité de {{clinic_name}}, {{first_name}} ! Vous venez de gagner vos premiers points. Plus vous venez, plus vous gagnez ! Détails : {{loyalty_link}}'}},
      {id:'e1',type:'email',label:'Email avantages',icon:'📧',x:420,y:200,config:{subject:'Vos avantages fidélité — {{clinic_name}}',body:'Bonjour {{first_name}} 🎁\n\nBienvenue dans notre programme de fidélité !\n\n✅ 1 point = 1 € dépensé\n✅ 100 points = 1 € de remise\n✅ 4 niveaux : Bronze → Platinum\n\nVos points sont crédités automatiquement après chaque paiement.\n\n{{clinic_name}}'}},
    ],
    edges:[{from:'t',to:'wa1'},{from:'wa1',to:'e1'}],
  },
  {
    id: 'tpl_birthday',
    categorie: 'fidelite',
    nom: 'Offre anniversaire patient',
    description: 'Message automatique le jour de l\'anniversaire avec cadeau surprise (points bonus ou remise)',
    icon: '🎂',
    color: '#EC4899',
    trigger: 'scheduled',
    nb_etapes: 2,
    tags: ['WhatsApp', 'Email', 'Planifié'],
    nodes: [
      {id:'t',type:'trigger',label:'Planifié (quotidien)',icon:'🕐',x:60,y:200,config:{cron:'0 9 * * *'}},
      {id:'c1',type:'condition',label:'Anniversaire aujourd\'hui ?',icon:'🔀',x:260,y:200,config:{field:'is_birthday_today',operator:'equals',value:'true'}},
      {id:'wa1',type:'whatsapp',label:'Happy Birthday !',icon:'💬',x:460,y:200,config:{body:'🎂 Joyeux anniversaire {{first_name}} ! Toute l\'équipe de {{clinic_name}} vous souhaite une magnifique journée ! Pour votre anniversaire, nous vous offrons 50 points fidélité cadeau 🎁 À très bientôt !'}},
      {id:'e1',type:'email',label:'Email anniversaire',icon:'📧',x:660,y:200,config:{subject:'🎂 Joyeux anniversaire {{first_name}} !',body:'Bonjour {{first_name}},\n\nToute l\'équipe de {{clinic_name}} vous souhaite un joyeux anniversaire ! 🎉\n\nPour célébrer ce jour spécial, nous vous offrons :\n🎁 50 points fidélité offerts\n\nÀ très bientôt !\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'c1'},
      {from:'c1',to:'wa1',branch:'true'},
      {from:'wa1',to:'e1'},
    ],
  },

  // ── Capillaire ─────────────────────────────────────────────────
  {
    id: 'tpl_greffe_complete',
    categorie: 'capillaire',
    nom: 'Parcours Greffe Capillaire — 1 an',
    description: 'Suivi complet greffe FUE/DHI : pré-op, J+1, J+7, J+30, 3 mois, 6 mois, 1 an',
    icon: '💈',
    color: '#D97706',
    trigger: 'consultation_created',
    nb_etapes: 12,
    tags: ['Email', 'WhatsApp', '1 an', 'FUE'],
    nodes: [
      {id:'t',type:'trigger',label:'Consultation greffe',icon:'⚡',x:60,y:200,config:{}},
      {id:'intake',type:'send_intake_form',label:'Formulaire anamnèse',icon:'📋',x:260,y:200,config:{}},
      {id:'d_preop',type:'delay',label:'J-7',icon:'⏰',x:460,y:200,config:{days:-7}},
      {id:'e_preop',type:'email',label:'Instructions pré-op',icon:'📧',x:640,y:200,config:{subject:'Instructions avant votre greffe',body:'Bonjour {{first_name}},\n\n⚠️ OBLIGATOIRE avant votre greffe :\n🚫 Arrêter Minoxidil 2 semaines\n🚫 Pas alcool 48h\n🚫 Pas aspirine 10j\n✅ Cheveux propres\n✅ Vêtements boutonnés\n✅ Accompagnant prévu\n\nLe Jour J 💈'}},
      {id:'wa_veille',type:'whatsapp',label:'Rappel veille',icon:'💬',x:820,y:200,config:{body:'Bonjour {{first_name}} ! Votre greffe est DEMAIN 💈 Cheveux propres, vêtements boutonnés, accompagnant prévu. Dormez bien !'}},
      {id:'d_j1',type:'delay',label:'J+1',icon:'⏰',x:1000,y:200,config:{days:1}},
      {id:'wa_j1',type:'whatsapp',label:'J+1 suivi',icon:'💬',x:1180,y:200,config:{body:'Bonjour {{first_name}} ! Comment vous sentez-vous ? Continuez les antibiotiques et dormez tête surélevée 🙏'}},
      {id:'d_j30',type:'delay',label:'J+30',icon:'⏰',x:1360,y:200,config:{days:29}},
      {id:'wa_j30',type:'whatsapp',label:'J+30 — photos',icon:'💬',x:1540,y:200,config:{body:'1 mois après votre greffe 📸 Le "shock loss" est normal et prévu. Repousse dans 3-4 mois. Envoyez-nous des photos !'}},
      {id:'d_3m',type:'delay',label:'3 mois',icon:'⏰',x:1720,y:200,config:{days:60}},
      {id:'e_3m',type:'email',label:'Bilan 3 mois',icon:'📧',x:1900,y:200,config:{subject:'3 mois — les repousses arrivent !',body:'Bonjour {{first_name}},\n\n3 mois après votre greffe, les premières repousses commencent ! Résultat final à 12 mois.\n\nEnvoyez-nous des photos pour le suivi 📸\n\n{{clinic_name}}'}},
      {id:'d_1an',type:'delay',label:'1 an',icon:'⏰',x:2080,y:200,config:{days:270}},
      {id:'e_1an',type:'email',label:'Bilan 1 an',icon:'📧',x:2260,y:200,config:{subject:'🎉 1 an — résultats définitifs !',body:'Bonjour {{first_name}},\n\n1 an après votre greffe — résultat définitif ! Venez pour un bilan photos.\n\nUn avis Google nous ferait très plaisir ❤️\n\n{{clinic_name}}'}},
    ],
    edges:[
      {from:'t',to:'intake'},{from:'intake',to:'d_preop'},{from:'d_preop',to:'e_preop'},
      {from:'e_preop',to:'wa_veille'},{from:'wa_veille',to:'d_j1'},{from:'d_j1',to:'wa_j1'},
      {from:'wa_j1',to:'d_j30'},{from:'d_j30',to:'wa_j30'},{from:'wa_j30',to:'d_3m'},
      {from:'d_3m',to:'e_3m'},{from:'e_3m',to:'d_1an'},{from:'d_1an',to:'e_1an'},
    ],
  },
]

export default function FlowsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [flows, setFlows]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [creating, setCreating] = useState(false)
  const [tab, setTab]           = useState<'mes-flows'|'templates'>('mes-flows')
  const [catFilter, setCatFilter] = useState('all')
  const [previewTemplate, setPreviewTemplate] = useState<any>(null)
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newTrigger, setNewTrigger] = useState('consultation_created')
  const [toast, setToast]       = useState<any>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const { data } = await supabase
      .from('workflow_definitions')
      .select('*, treatment:treatments(name,color)')
      .eq('clinic_id', prof.clinic_id)
      .order('created_at', { ascending: false })
    setFlows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('workflow_definitions').update({ is_active: !current }).eq('id', id)
    setFlows(prev => prev.map(f => f.id === id ? { ...f, is_active: !current } : f))
  }

  async function deleteFlow(id: string) {
    if (!confirm('Supprimer ce workflow ?')) return
    await supabase.from('workflow_definitions').delete().eq('id', id)
    setFlows(prev => prev.filter(f => f.id !== id))
    showToast('Workflow supprimé')
  }

  async function createFromTemplate(tpl: typeof WORKFLOW_TEMPLATES[0]) {
    if (!clinicId) return
    setCreating(true)
    const { data: flow, error } = await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId,
      name: tpl.nom,
      description: tpl.description,
      trigger_type: tpl.trigger,
      is_active: false,
      nodes: tpl.nodes,
      edges: tpl.edges,
      run_count: 0,
    }).select().single()
    setCreating(false)
    if (!error && flow) {
      showToast(`✓ Template "${tpl.nom}" ajouté`)
      setPreviewTemplate(null)
      setTab('mes-flows')
      load()
      router.push(`/dashboard/flows/${flow.id}`)
    }
  }

  async function createBlank() {
    if (!newName || !clinicId) return
    setCreating(true)
    const { data: flow, error } = await supabase.from('workflow_definitions').insert({
      clinic_id: clinicId,
      name: newName,
      trigger_type: newTrigger,
      is_active: false,
      nodes: [{ id:'trigger', type:'trigger', label:'Déclencheur', icon:'⚡', x:60, y:200, config:{} }],
      edges: [],
      run_count: 0,
    }).select().single()
    setCreating(false)
    if (!error && flow) {
      setShowNew(false)
      router.push(`/dashboard/flows/${flow.id}`)
    }
  }

  const filteredTemplates = catFilter === 'all' ? WORKFLOW_TEMPLATES : WORKFLOW_TEMPLATES.filter(t => t.categorie === catFilter)

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background:'#022C22', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>{toast.msg}</div>}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Workflows & Automatisations</div>
          <div className="page-subtitle">{flows.length} workflow{flows.length > 1 ? 's' : ''} · {flows.filter(f => f.is_active).length} actif{flows.filter(f=>f.is_active).length>1?'s':''}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { setTab('templates') }} className="btn-secondary" style={{ fontSize:13 }}>
            📚 Templates ({WORKFLOW_TEMPLATES.length})
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>
            + Nouveau workflow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:'white', borderBottom:'1px solid var(--gray-200)', padding:'0 28px', display:'flex', gap:0 }}>
        {([['mes-flows','⚡ Mes workflows'],['templates','📚 Bibliothèque de templates']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? 'var(--blue)' : 'var(--gray-500)', borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-content">

        {/* ── MES WORKFLOWS ── */}
        {tab === 'mes-flows' && (
          loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
          ) : flows.length === 0 ? (
            <div className="card" style={{ padding:56, textAlign:'center' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>⚡</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--gray-800)', marginBottom:6 }}>Aucun workflow encore</div>
              <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:24, maxWidth:420, margin:'0 auto 24px' }}>
                Commencez avec un template prêt à l'emploi ou créez votre propre workflow personnalisé.
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => setTab('templates')} className="btn-secondary" style={{ fontSize:13 }}>📚 Voir les templates</button>
                <button onClick={() => setShowNew(true)} className="btn-primary" style={{ fontSize:13 }}>+ Créer depuis zéro</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {flows.map(flow => {
                const tc = TRIGGER_CFG[flow.trigger_type] ?? TRIGGER_CFG.manual
                const nodeCount = (flow.nodes ?? []).length
                return (
                  <div key={flow.id} className="card" style={{ padding:'16px 20px', display:'flex', gap:14, alignItems:'center', borderLeft:`4px solid ${flow.is_active ? tc.color : 'var(--gray-200)'}` }}>
                    <div style={{ width:40, height:40, borderRadius:10, background: flow.is_active ? tc.bg : 'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {tc.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                        <Link href={`/dashboard/flows/${flow.id}`} style={{ fontWeight:700, fontSize:14, color:'var(--gray-900)', textDecoration:'none' }}>
                          {flow.name}
                        </Link>
                        <span style={{ fontSize:11, fontWeight:600, color:tc.color, background:tc.bg, padding:'1px 7px', borderRadius:99 }}>{tc.label}</span>
                        {flow.is_active && <span style={{ fontSize:10, background:'#ECFDF5', color:'#059669', padding:'1px 7px', borderRadius:99, fontWeight:700 }}>● Actif</span>}
                      </div>
                      <div style={{ fontSize:12, color:'var(--gray-500)', display:'flex', gap:10 }}>
                        <span>{nodeCount} étapes</span>
                        <span>·</span>
                        <span>{flow.run_count ?? 0} exécutions</span>
                        {flow.description && <><span>·</span><span>{flow.description}</span></>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      <button onClick={() => toggleActive(flow.id, flow.is_active)}
                        style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${flow.is_active ? '#FECACA' : '#BBF7D0'}`, background: flow.is_active ? '#FEF2F2' : '#ECFDF5', color: flow.is_active ? '#DC2626' : '#059669', cursor:'pointer', fontWeight:600 }}>
                        {flow.is_active ? '⏸ Désactiver' : '▶ Activer'}
                      </button>
                      <Link href={`/dashboard/flows/${flow.id}`} className="btn-secondary" style={{ fontSize:12, textDecoration:'none' }}>Modifier</Link>
                      <button onClick={() => deleteFlow(flow.id)} style={{ fontSize:11, padding:'5px 9px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', color:'var(--gray-400)', cursor:'pointer' }}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TEMPLATES ── */}
        {tab === 'templates' && (
          <>
            {/* Category filters */}
            <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
              {TEMPLATE_CATEGORIES.map(cat => {
                const count = cat.id === 'all' ? WORKFLOW_TEMPLATES.length : WORKFLOW_TEMPLATES.filter(t => t.categorie === cat.id).length
                return (
                  <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                    style={{ padding:'6px 14px', borderRadius:20, fontSize:12.5, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5, background: catFilter===cat.id ? '#0F172A' : 'white', color: catFilter===cat.id ? 'white' : 'var(--gray-600)', border: catFilter===cat.id ? 'none' : '1px solid var(--gray-200)', transition:'all .12s' }}>
                    <span>{cat.icon}</span> {cat.label} <span style={{ fontSize:10, opacity:.7 }}>({count})</span>
                  </button>
                )
              })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
              {filteredTemplates.map(tpl => (
                <div key={tpl.id} className="card" style={{ padding:20, cursor:'pointer', borderTop:`3px solid ${tpl.color}`, transition:'all .15s' }}
                  onClick={() => setPreviewTemplate(tpl)}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>
                  <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${tpl.color}15`, border:`1px solid ${tpl.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {tpl.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:2 }}>{tpl.nom}</div>
                      <div style={{ fontSize:11, color:TRIGGER_CFG[tpl.trigger]?.color ?? '#6B7280', background:TRIGGER_CFG[tpl.trigger]?.bg ?? '#F3F4F6', display:'inline-block', padding:'1px 6px', borderRadius:99, fontWeight:600 }}>
                        {TRIGGER_CFG[tpl.trigger]?.icon} {TRIGGER_CFG[tpl.trigger]?.label}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize:12.5, color:'var(--gray-600)', lineHeight:1.5, marginBottom:12 }}>{tpl.description}</p>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
                    {tpl.tags.map(tag => (
                      <span key={tag} style={{ fontSize:10, background:'var(--gray-100)', color:'var(--gray-600)', padding:'2px 7px', borderRadius:99 }}>{tag}</span>
                    ))}
                    <span style={{ fontSize:10, background:`${tpl.color}15`, color:tpl.color, padding:'2px 7px', borderRadius:99, fontWeight:600 }}>{tpl.nb_etapes} étapes</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); createFromTemplate(tpl) }} disabled={creating}
                    style={{ width:'100%', padding:'8px', borderRadius:8, border:'none', background:tpl.color, color:'white', fontSize:12, fontWeight:700, cursor:'pointer', opacity: creating ? .6 : 1 }}>
                    {creating ? 'Création...' : '+ Utiliser ce template'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal nouveau workflow vide */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-header">
              <div className="modal-title">⚡ Nouveau workflow</div>
              <button onClick={() => setShowNew(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="label">Nom du workflow *</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Suivi post-injection HA" autoFocus />
              </div>
              <div>
                <label className="label">Déclencheur</label>
                <select className="input" value={newTrigger} onChange={e => setNewTrigger(e.target.value)}>
                  {Object.entries(TRIGGER_CFG).map(([key, tc]) => (
                    <option key={key} value={key}>{tc.icon} {tc.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding:12, background:'var(--gray-50)', borderRadius:9, fontSize:12, color:'var(--gray-500)' }}>
                💡 Vous pouvez aussi partir d'un <button onClick={() => { setShowNew(false); setTab('templates') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--blue)', fontSize:12, fontWeight:600, padding:0 }}>template prêt à l'emploi</button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
              <button onClick={createBlank} disabled={creating || !newName} className="btn-primary">{creating ? 'Création...' : '→ Créer et ouvrir le builder'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal preview template */}
      {previewTemplate && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:580 }}>
            <div className="modal-header" style={{ borderBottom:`3px solid ${previewTemplate.color}` }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:22 }}>{previewTemplate.icon}</span>
                <div>
                  <div className="modal-title">{previewTemplate.nom}</div>
                  <div style={{ fontSize:11, color:'var(--gray-500)', marginTop:2 }}>{previewTemplate.nb_etapes} étapes · {TRIGGER_CFG[previewTemplate.trigger]?.label}</div>
                </div>
              </div>
              <button onClick={() => setPreviewTemplate(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5, color:'var(--gray-600)', lineHeight:1.6, marginBottom:16 }}>{previewTemplate.description}</p>
              {/* Steps preview */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Étapes du workflow</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {previewTemplate.nodes.map((node: any, i: number) => {
                  const colors: Record<string, {c:string;bg:string}> = {
                    trigger:{c:'#D97706',bg:'#FFFBEB'}, email:{c:'#0596DE',bg:'#EFF6FF'},
                    whatsapp:{c:'#059669',bg:'#ECFDF5'}, delay:{c:'#6B7280',bg:'#F3F4F6'},
                    condition:{c:'#7C3AED',bg:'#F5F3FF'}, send_intake_form:{c:'#0891B2',bg:'#ECFEFF'},
                  }
                  const cfg = colors[node.type] ?? {c:'#6B7280',bg:'#F3F4F6'}
                  return (
                    <div key={node.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 10px', background:cfg.bg, borderRadius:7 }}>
                      <span style={{ fontSize:13 }}>{node.icon}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:cfg.c }}>{node.label}</span>
                      {node.config?.days && <span style={{ fontSize:10, color:'var(--gray-400)', marginLeft:'auto' }}>{node.config.days > 0 ? `+${node.config.days}j` : `${node.config.days}j`}</span>}
                      {node.config?.hours && <span style={{ fontSize:10, color:'var(--gray-400)', marginLeft:'auto' }}>+{node.config.hours}h</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:14 }}>
                {previewTemplate.tags.map((tag: string) => (
                  <span key={tag} style={{ fontSize:11, background:'var(--gray-100)', color:'var(--gray-600)', padding:'3px 9px', borderRadius:99 }}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setPreviewTemplate(null)} className="btn-secondary">Fermer</button>
              <button onClick={() => createFromTemplate(previewTemplate)} disabled={creating} className="btn-primary" style={{ background:previewTemplate.color }}>
                {creating ? 'Création...' : `+ Utiliser "${previewTemplate.nom}"`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
