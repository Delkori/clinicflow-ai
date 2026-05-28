import Link from 'next/link'

const COMPANY = {
  name: '[NOM DE VOTRE SOCIÉTÉ]',
  form: '[SARL / SAS / SASU]',
  capital: '[CAPITAL SOCIAL]',
  siret: '[NUMÉRO SIRET]',
  address: '[ADRESSE DU SIÈGE SOCIAL]',
  email: 'contact@clinicflow.ai',
  rcs: '[VILLE D\'IMMATRICULATION]',
  host: 'Vercel Inc., 340 Pine Street Suite 701, San Francisco, California 94104',
  data_host: 'Supabase Inc. — Serveurs AWS eu-west-3 (Paris, France)',
}

const SECTIONS = [
  {
    id: 'mentions',
    label: 'Mentions légales',
    icon: '📋',
    content: `
## Éditeur du site

**${COMPANY.name}**
${COMPANY.form} au capital de ${COMPANY.capital}
SIRET : ${COMPANY.siret}
Siège social : ${COMPANY.address}
RCS : ${COMPANY.rcs}
Email : ${COMPANY.email}

## Hébergement

Ce site est hébergé par :
**${COMPANY.host}**

Les données sont stockées par :
**${COMPANY.data_host}**

## Propriété intellectuelle

L'ensemble du contenu de la plateforme ClinicFlow AI (textes, graphiques, logiciels, code source) est protégé par le droit d'auteur. Toute reproduction ou représentation, totale ou partielle, est interdite sans l'autorisation préalable de ${COMPANY.name}.

## Responsabilité

ClinicFlow AI est un outil de gestion administrative à destination des professionnels de santé. Les informations contenues dans les dossiers patients sont sous la responsabilité exclusive du professionnel de santé utilisateur. ${COMPANY.name} ne saurait être tenu responsable d'un usage inapproprié de la plateforme.
    `
  },
  {
    id: 'cgu',
    label: "Conditions d'utilisation",
    icon: '📄',
    content: `
## Objet

Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme ClinicFlow AI, solution de gestion de cabinet pour professionnels de médecine esthétique.

## Accès au service

L'accès à ClinicFlow AI est réservé aux professionnels de santé dûment enregistrés. Chaque utilisateur est responsable de la confidentialité de ses identifiants de connexion.

## Données de santé

En tant que professionnel de santé, vous êtes responsable du traitement des données de santé de vos patients conformément au RGPD et à la réglementation française (loi Informatique et Libertés). Vous agissez en qualité de **responsable de traitement**. ${COMPANY.name} agit en qualité de **sous-traitant** au sens de l'article 28 du RGPD.

## Obligations de l'utilisateur

L'utilisateur s'engage à :
- Utiliser la plateforme dans le respect du secret médical
- Ne pas partager ses identifiants
- Informer ses patients de l'utilisation de ClinicFlow AI pour la gestion de leur dossier
- Respecter la réglementation RGPD concernant les données de santé

## Disponibilité du service

${COMPANY.name} s'efforce de maintenir le service disponible 24h/24, 7j/7. Des interruptions ponctuelles pour maintenance peuvent survenir. ${COMPANY.name} ne garantit pas une disponibilité de 100%.

## Résiliation

Chaque partie peut résilier le contrat avec un préavis de 30 jours. En cas de résiliation, les données du client sont exportables pendant 30 jours puis supprimées.

## Droit applicable

Les présentes CGU sont soumises au droit français. Tout litige sera de la compétence exclusive des tribunaux français.
    `
  },
  {
    id: 'privacy',
    label: 'Politique de confidentialité',
    icon: '🔒',
    content: `
## Responsable de traitement

**${COMPANY.name}** — ${COMPANY.email}

En tant que sous-traitant au sens du RGPD, nous traitons les données de santé pour le compte des professionnels de santé utilisateurs, qui restent responsables de traitement.

## Données collectées

**Données des utilisateurs (professionnels de santé) :**
- Nom, prénom, adresse email, téléphone
- Informations de la clinique/cabinet
- Historique d'utilisation de la plateforme

**Données des patients (traitées pour compte du professionnel) :**
- Données d'identité : nom, prénom, date de naissance, coordonnées
- Données de santé : antécédents médicaux, consultations, traitements, photos médicales
- Documents : consentements, devis, comptes-rendus

## Base légale

- **Exécution du contrat** pour les données des professionnels abonnés
- **Intérêt légitime** pour l'amélioration du service (données anonymisées)
- **Obligation légale** pour la conservation des données médicales (10 ans)
- **Consentement** du patient recueilli par le professionnel de santé

## Hébergement et sécurité

Les données sont hébergées sur **AWS Paris (eu-west-3)** via Supabase. Les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256).

⚠️ **Important** : ClinicFlow AI n'est pas actuellement certifié HDS (Hébergeur de Données de Santé). En attendant cette certification, les professionnels de santé sont responsables de s'assurer que leur usage est conforme à la réglementation applicable. La certification HDS est en cours d'obtention.

## Durée de conservation

- Données de compte : durée de l'abonnement + 3 ans
- Données patients : 10 ans conformément au Code de la santé publique
- Logs techniques : 12 mois

## Droits des personnes

Conformément au RGPD, vous disposez des droits suivants :
- **Accès** à vos données personnelles
- **Rectification** des données inexactes
- **Suppression** ("droit à l'oubli")
- **Portabilité** de vos données
- **Opposition** au traitement

Pour exercer ces droits : **${COMPANY.email}**

Vous pouvez également déposer une réclamation auprès de la **CNIL** : www.cnil.fr

## Transferts de données

Certains sous-traitants peuvent être situés hors de l'UE (ex: OpenAI pour la transcription IA). Ces transferts sont encadrés par des clauses contractuelles types approuvées par la Commission européenne. Les données de santé transmises à l'IA sont anonymisées avant traitement.

## Cookies

ClinicFlow AI utilise uniquement des cookies strictement nécessaires au fonctionnement de la plateforme (session d'authentification). Aucun cookie publicitaire ou de tracking n'est utilisé.
    `
  },
  {
    id: 'dpa',
    label: 'DPA — Accord sous-traitance',
    icon: '🤝',
    content: `
## Accord de traitement des données (DPA)

Conformément à l'article 28 du Règlement (UE) 2016/679 (RGPD), le présent accord encadre le traitement des données personnelles confié par le Responsable de traitement (le professionnel de santé abonné) au Sous-traitant (${COMPANY.name}).

## Objet et durée

Le sous-traitant traite les données personnelles pour fournir les services ClinicFlow AI pendant la durée du contrat d'abonnement.

## Nature des traitements

- Stockage et sauvegarde des dossiers patients
- Envoi de communications automatisées (emails, SMS, WhatsApp)
- Génération de documents médicaux
- Transcription audio des consultations via IA
- Synchronisation avec des services tiers (Doctolib, Google Calendar)

## Obligations du sous-traitant

${COMPANY.name} s'engage à :
- Ne traiter les données que sur instruction documentée du responsable de traitement
- Garantir la confidentialité des données traitées
- Notifier toute violation de données dans les 72h
- Sous-traiter uniquement à des sous-traitants ultérieurs offrant des garanties suffisantes
- Supprimer ou restituer les données à la fin du contrat
- Mettre à disposition toute information nécessaire au contrôle de conformité

## Sous-traitants ultérieurs

| Sous-traitant | Pays | Finalité |
|--------------|------|----------|
| Supabase / AWS | France (eu-west-3) | Hébergement données |
| Vercel Inc. | USA (SCC) | Hébergement application |
| OpenAI | USA (SCC) | Transcription IA (données anonymisées) |
| Resend | USA (SCC) | Envoi d'emails |
| Twilio | USA (SCC) | SMS et WhatsApp |
| Yousign | France | Signature électronique |

*SCC = Clauses Contractuelles Standard de la Commission européenne*

## Contact DPO

Pour toute question relative à la protection des données : **${COMPANY.email}**
    `
  }
]

export default function LegalPage({ params }: { params: { section?: string } }) {
  const currentId = 'mentions'

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'#0F172A', padding:'20px 0' }}>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{ width:28, height:28, background:'#0596DE', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:14 }}>ClinicFlow AI</span>
          </Link>
          <Link href="/auth/login" style={{ fontSize:13, color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>← Retour à l'application</Link>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'40px 24px', display:'grid', gridTemplateColumns:'220px 1fr', gap:28, alignItems:'start' }}>
        {/* Sidebar */}
        <div style={{ background:'white', borderRadius:12, border:'1px solid #E2E8F0', overflow:'hidden', position:'sticky', top:24 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #F1F5F9' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.07em' }}>Documents légaux</div>
          </div>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`}
              style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 16px', borderBottom:'1px solid #F8FAFC', textDecoration:'none', color:'#475569', fontSize:13, transition:'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background='#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </a>
          ))}
          <div style={{ padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:'#94A3B8', lineHeight:1.5 }}>
              Dernière mise à jour :<br />
              <strong style={{ color:'#64748B' }}>{new Date().toLocaleDateString('fr-FR')}</strong>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Warning banner */}
          <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'14px 16px', display:'flex', gap:10 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
            <div style={{ fontSize:13, color:'#92400E', lineHeight:1.6 }}>
              <strong>Documents en cours de finalisation</strong> — Ces pages seront complétées dès la création de la société. Les mentions entre crochets [&nbsp;] doivent être remplacées par les informations définitives.
            </div>
          </div>

          {SECTIONS.map(s => (
            <div key={s.id} id={s.id} style={{ background:'white', borderRadius:12, border:'1px solid #E2E8F0', overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>{s.icon}</span>
                <h2 style={{ fontSize:17, fontWeight:700, color:'#0F172A', margin:0 }}>{s.label}</h2>
              </div>
              <div style={{ padding:'24px', fontSize:14, color:'#475569', lineHeight:1.8 }}>
                {s.content.trim().split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize:15, fontWeight:700, color:'#0F172A', margin:'20px 0 8px', paddingBottom:6, borderBottom:'1px solid #F1F5F9' }}>{line.replace('## ','')}</h3>
                  if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight:600, color:'#0F172A', margin:'4px 0' }}>{line.replace(/\*\*/g,'')}</p>
                  if (line.startsWith('- ')) return <div key={i} style={{ display:'flex', gap:8, margin:'3px 0', paddingLeft:8 }}><span style={{ color:'#0596DE', flexShrink:0 }}>•</span><span>{line.replace('- ','')}</span></div>
                  if (line.startsWith('| ')) {
                    const cells = line.split('|').filter(c => c.trim() && !c.trim().match(/^-+$/))
                    if (cells.length === 0) return null
                    const isHeader = line.includes('Sous-traitant')
                    return (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:'#E2E8F0', marginTop: isHeader ? 8 : 0 }}>
                        {cells.map((c, j) => (
                          <div key={j} style={{ padding:'7px 10px', background: isHeader ? '#F8FAFC' : 'white', fontSize:12.5, fontWeight: isHeader ? 600 : 400, color: isHeader ? '#475569' : '#64748B' }}>{c.trim()}</div>
                        ))}
                      </div>
                    )
                  }
                  if (!line.trim()) return <div key={i} style={{ height:8 }} />
                  return <p key={i} style={{ margin:'3px 0' }}>{line}</p>
                })}
              </div>
            </div>
          ))}

          {/* Contact */}
          <div style={{ background:'white', borderRadius:12, border:'1px solid #E2E8F0', padding:'20px 24px', display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>✉️</div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'#0F172A', marginBottom:3 }}>Des questions sur vos données ?</div>
              <div style={{ fontSize:13, color:'#64748B' }}>Contactez-nous : <a href={`mailto:${COMPANY.email}`} style={{ color:'#0596DE' }}>{COMPANY.email}</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
