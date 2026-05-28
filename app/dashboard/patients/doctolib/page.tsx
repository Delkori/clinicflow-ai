'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function DoctolibPatientsPage() {
  const supabase = createClient()
  const [patients, setPatients]   = useState<any[]>([])
  const [sources, setSources]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string|null>(null)
  const [sending, setSending]     = useState<string|null>(null)
  const [toast, setToast]         = useState<any>(null)
  const [clinicId, setClinicId]   = useState('')
  const [filter, setFilter]       = useState<'all'|'pending'|'complete'|'no_contact'>('all')
  const [baseUrl, setBaseUrl]     = useState('')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin)

    const [{ data: pts }, { data: srcs }] = await Promise.all([
      supabase.from('patients')
        .select('*, intake:patient_intake_forms(token, status, completed_at)')
        .eq('clinic_id', prof.clinic_id)
        .eq('source', 'doctolib')
        .order('created_at', { ascending: false }),
      supabase.from('ical_sources').select('*').eq('clinic_id', prof.clinic_id),
    ])
    setPatients(pts ?? [])
    setSources(srcs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function syncSource(source: any) {
    setSyncing(source.id)
    const res = await fetch('/api/ical/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: source.id, clinic_id: clinicId }),
    })
    const data = await res.json()
    setSyncing(null)
    if (data.success) {
      showToast(`✓ ${data.created} RDV importés · ${data.patient_created} nouveaux patients`)
      load()
    } else {
      showToast(`Erreur : ${data.error}`, false)
    }
  }

  async function sendIntakeForm(patient: any) {
    setSending(patient.id)
    try {
      // Create intake form if doesn't exist
      let token: string | null = patient.intake?.token ?? null
      if (!token) {
        const { data: form } = await supabase.from('patient_intake_forms').insert({
          clinic_id: clinicId,
          patient_id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          status: 'pending',
        }).select('token').single()
        token = form?.token ?? null
      }

      if (!token) { showToast('Erreur création formulaire', false); setSending(null); return }

      const intakeUrl = `${baseUrl}/intake/${token}`

      // Send via WhatsApp if phone available
      if (patient.phone) {
        const phone = patient.phone.replace(/\D/g, '').replace(/^0/, '33')
        const message = `Bonjour ${patient.first_name} ! Afin de préparer votre consultation, merci de compléter votre dossier médical en quelques minutes : ${intakeUrl}`
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        window.open(waUrl, '_blank')
        showToast(`✓ WhatsApp ouvert — lien formulaire copié`)
      } else if (patient.email) {
        // Send via email API
        await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: patient.id,
            subject: 'Complétez votre dossier avant votre rendez-vous — {{clinic_name}}',
            body: `Bonjour {{first_name}},\n\nAfin de préparer votre consultation dans les meilleures conditions, merci de compléter votre dossier médical en cliquant sur le lien ci-dessous :\n\n${intakeUrl}\n\nCela ne prend que 2 minutes.\n\nCordialement,\n{{clinic_name}}`,
          }),
        })
        showToast(`✓ Email envoyé à ${patient.email}`)
      } else {
        // No contact info — just copy link
        await navigator.clipboard.writeText(intakeUrl)
        showToast('Lien formulaire copié — aucun contact disponible')
      }

      // Update patient to show intake was sent
      await supabase.from('patient_intake_forms').update({ status: 'pending' }).eq('patient_id', patient.id)
      load()
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, false)
    }
    setSending(null)
  }

  // Classify patients
  const classify = (p: any) => {
    const intake = Array.isArray(p.intake) ? p.intake[0] : p.intake
    if (!p.email && !p.phone) return 'no_contact'
    if (intake?.status === 'completed') return 'complete'
    return 'pending'
  }

  const filtered = patients.filter(p => filter === 'all' || classify(p) === filter)

  const stats = {
    total: patients.length,
    complete: patients.filter(p => classify(p) === 'complete').length,
    pending: patients.filter(p => classify(p) === 'pending').length,
    no_contact: patients.filter(p => classify(p) === 'no_contact').length,
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background: toast.ok ? '#022C22' : '#450A0A', color:'white', padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:500 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:6 }}>
            <Link href="/dashboard/patients" style={{ color:'var(--gray-400)', textDecoration:'none' }}>Patients</Link> › Doctolib
          </div>
          <div className="page-title">Patients Doctolib</div>
          <div className="page-subtitle">{stats.total} patients importés · {stats.complete} dossiers complets · {stats.pending} en attente</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/import" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>📄 Import CSV</Link>
          <Link href="/dashboard/settings?tab=doctolib" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>⚙ Config iCal</Link>
        </div>
      </div>

      <div className="page-content">
        {/* iCal sources */}
        {sources.length > 0 && (
          <div className="card" style={{ padding:16, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-700)', marginBottom:10 }}>Flux iCal configurés</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {sources.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'var(--gray-50)', borderRadius:9, border:'1px solid var(--gray-200)' }}>
                  <span style={{ fontSize:14 }}>📅</span>
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:500, color:'var(--gray-800)' }}>{s.name}</div>
                    {s.last_synced_at && <div style={{ fontSize:10, color:'var(--gray-400)' }}>Dernière sync : {formatDateTime(s.last_synced_at)}</div>}
                  </div>
                  <button onClick={() => syncSource(s)} disabled={syncing === s.id}
                    style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:'none', background:'var(--blue)', color:'white', cursor:'pointer', fontWeight:600, display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
                    {syncing === s.id ? <><div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Sync...</> : '🔄 Synchroniser'}
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works if no sources */}
        {sources.length === 0 && (
          <div className="card" style={{ padding:20, marginBottom:16, borderLeft:'4px solid var(--blue)' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:10 }}>🔄 Synchronisation automatique avec Doctolib</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <div style={{ fontSize:12, color:'var(--gray-600)', lineHeight:1.7, marginBottom:10 }}>
                  <strong>Option 1 — iCal (recommandé)</strong><br/>
                  Doctolib génère un flux `.ics` que ClinicFlow synchronise automatiquement toutes les heures. Les nouveaux RDV créent automatiquement les fiches patients.
                </div>
                <Link href="/dashboard/settings?tab=doctolib" className="btn-primary" style={{ textDecoration:'none', fontSize:12, display:'inline-flex' }}>
                  Configurer le flux iCal →
                </Link>
              </div>
              <div>
                <div style={{ fontSize:12, color:'var(--gray-600)', lineHeight:1.7, marginBottom:10 }}>
                  <strong>Option 2 — Export CSV</strong><br/>
                  Depuis Doctolib Pro → Patients → Exporter CSV. Donne accès aux emails et téléphones que l'iCal ne contient pas.
                </div>
                <Link href="/dashboard/import" className="btn-secondary" style={{ textDecoration:'none', fontSize:12, display:'inline-flex' }}>
                  Importer un CSV →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats + filter */}
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          {([
            ['all',        `Tous (${stats.total})`,              '#475569', '#F8FAFC'],
            ['complete',   `✅ Dossier complet (${stats.complete})`, '#059669', '#F0FDF4'],
            ['pending',    `⏳ Formulaire en attente (${stats.pending})`, '#D97706', '#FFFBEB'],
            ['no_contact', `📵 Sans contact (${stats.no_contact})`, '#DC2626', '#FEF2F2'],
          ] as const).map(([f, label, color, bg]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filter===f ? color : 'white', color: filter===f ? 'white' : color, border: filter===f ? 'none' : `1px solid ${bg}`, outline: filter===f ? 'none' : `1px solid ${bg}` }}>
              {label}
            </button>
          ))}
        </div>

        {/* Patient list */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>
              {patients.length === 0 ? 'Aucun patient Doctolib importé' : 'Aucun patient dans ce filtre'}
            </div>
            <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>
              {patients.length === 0 ? 'Configurez un flux iCal ou importez un CSV depuis Doctolib Pro' : 'Tous les patients sont dans les autres catégories'}
            </div>
            {patients.length === 0 && (
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <Link href="/dashboard/settings?tab=doctolib" className="btn-primary" style={{ textDecoration:'none', fontSize:13 }}>Configurer iCal</Link>
                <Link href="/dashboard/import" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>Import CSV</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Dossier</th>
                  <th>Importé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const intake = Array.isArray(p.intake) ? p.intake[0] : p.intake
                  const status = classify(p)
                  const hasContact = p.email || p.phone

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div className="avatar" style={{ width:32, height:32, fontSize:11, fontWeight:700 }}>{p.first_name?.[0]}{p.last_name?.[0]}</div>
                          <div>
                            <div style={{ fontSize:13.5, fontWeight:500, color:'var(--gray-900)' }}>{p.first_name} {p.last_name}</div>
                            {p.date_of_birth && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{formatDate(p.date_of_birth)}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {p.email && <div style={{ fontSize:12, color:'var(--gray-700)' }}>{p.email}</div>}
                        {p.phone && <div style={{ fontSize:12, color:'var(--gray-500)' }}>{p.phone}</div>}
                        {!hasContact && <span style={{ fontSize:11, color:'#DC2626', background:'#FEF2F2', padding:'2px 7px', borderRadius:99, fontWeight:500 }}>📵 Sans contact</span>}
                      </td>
                      <td>
                        {status === 'complete' && (
                          <span style={{ fontSize:11, fontWeight:600, color:'#059669', background:'#F0FDF4', padding:'3px 9px', borderRadius:99 }}>✅ Complet</span>
                        )}
                        {status === 'pending' && (
                          <div>
                            <span style={{ fontSize:11, fontWeight:600, color:'#D97706', background:'#FFFBEB', padding:'3px 9px', borderRadius:99 }}>⏳ En attente</span>
                            {intake?.token && (
                              <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:3 }}>
                                Formulaire envoyé
                              </div>
                            )}
                          </div>
                        )}
                        {status === 'no_contact' && (
                          <span style={{ fontSize:11, fontWeight:600, color:'#DC2626', background:'#FEF2F2', padding:'3px 9px', borderRadius:99 }}>📵 Pas de contact</span>
                        )}
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-500)' }}>{formatDate(p.created_at)}</td>
                      <td>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          {status !== 'complete' && hasContact && (
                            <button onClick={() => sendIntakeForm(p)} disabled={sending === p.id}
                              style={{ fontSize:11, padding:'5px 10px', borderRadius:7, border:'none', background: p.phone ? '#25D366' : 'var(--blue)', color:'white', cursor:'pointer', fontWeight:600, display:'flex', gap:4, alignItems:'center' }}>
                              {sending === p.id ? '...' : p.phone ? '💬 Envoyer WA' : '📧 Envoyer email'}
                            </button>
                          )}
                          {status === 'complete' && intake?.token && (
                            <a href={`/intake/${intake.token}`} target="_blank"
                              style={{ fontSize:11, padding:'5px 10px', borderRadius:7, border:'1px solid #BBF7D0', background:'#F0FDF4', color:'#166534', textDecoration:'none', fontWeight:600 }}>
                              👁 Voir
                            </a>
                          )}
                          <Link href={`/dashboard/patients/${p.id}`} style={{ fontSize:11, padding:'5px 10px', borderRadius:7, border:'1px solid var(--gray-200)', background:'white', color:'var(--blue)', textDecoration:'none', fontWeight:500 }}>
                            Fiche →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
