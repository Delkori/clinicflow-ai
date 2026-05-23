'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ROLE_CFG: Record<string, {label:string;color:string;bg:string;icon:string}> = {
  medecin:   { label:'Médecin principal',  color:'#1D4ED8', bg:'#EFF6FF', icon:'👨‍⚕️' },
  praticien: { label:'Praticien',          color:'#7C3AED', bg:'#FAF5FF', icon:'💉' },
  assistant: { label:'Assistant(e)',       color:'#059669', bg:'#F0FDF4', icon:'📋' },
  accueil:   { label:'Accueil',            color:'#D97706', bg:'#FFFBEB', icon:'👋' },
}

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers]       = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [clinicId, setClinicId]     = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [baseUrl, setBaseUrl]       = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin)
    const { data: prof } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!prof) return
    setClinicId(prof.clinic_id)
    const [{ data: mems }, { data: invs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('clinic_id', prof.clinic_id).order('created_at'),
      supabase.from('team_invitations').select('*').eq('clinic_id', prof.clinic_id).is('accepted_at', null).order('created_at', { ascending: false }),
    ])
    setMembers(mems ?? [])
    setInvitations(invs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function revokeInvitation(id: string) {
    await supabase.from('team_invitations').delete().eq('id', id)
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Équipe</div>
          <div className="page-subtitle">{members.length} membre{members.length > 1 ? 's' : ''} · Gérez les accès à votre clinique</div>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary" style={{ fontSize:13 }}>
          + Inviter un membre
        </button>
      </div>

      <div className="page-content">
        {/* Current members */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            👥 Membres actifs
            <span style={{ fontSize:11, background:'var(--gray-100)', color:'var(--gray-500)', padding:'1px 8px', borderRadius:99 }}>{members.length}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {members.map(m => {
              const rc = ROLE_CFG[m.role] ?? ROLE_CFG.assistant
              const isMe = m.id === currentUserId
              return (
                <div key={m.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, opacity: m.is_active === false ? 0.5 : 1 }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white', flexShrink:0 }}>
                    {m.full_name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>{m.full_name ?? 'Sans nom'}</span>
                      {isMe && <span style={{ fontSize:10, background:'var(--blue-light)', color:'var(--blue-dark)', padding:'1px 7px', borderRadius:99, fontWeight:600 }}>Moi</span>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{m.email}</div>
                    {m.speciality && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>📍 {m.speciality}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:rc.color, background:rc.bg, padding:'4px 10px', borderRadius:99, display:'flex', alignItems:'center', gap:4 }}>
                      {rc.icon} {rc.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              📨 Invitations en attente
              <span style={{ fontSize:11, background:'#FFFBEB', color:'#D97706', padding:'1px 8px', borderRadius:99, fontWeight:600 }}>{invitations.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {invitations.map(inv => {
                const rc = ROLE_CFG[inv.role] ?? ROLE_CFG.assistant
                const expired = new Date(inv.expires_at) < new Date()
                const inviteUrl = `${baseUrl}/auth/accept-invite?token=${inv.token}`
                return (
                  <div key={inv.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, opacity: expired ? 0.5 : 1 }}>
                    <div style={{ width:42, height:42, borderRadius:'50%', background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      ✉️
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-900)' }}>{inv.email}</div>
                      <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2, display:'flex', gap:8 }}>
                        <span className={`badge ${expired ? 'badge-gray' : 'badge-orange'}`} style={{ fontSize:10 }}>
                          {expired ? 'Expirée' : `Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:rc.color, background:rc.bg, padding:'4px 10px', borderRadius:99 }}>
                        {rc.icon} {rc.label}
                      </span>
                      <button onClick={() => { navigator.clipboard.writeText(inviteUrl) }}
                        style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--blue)' }}>
                        📋 Copier lien
                      </button>
                      <button onClick={() => revokeInvitation(inv.id)}
                        style={{ fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', cursor:'pointer', color:'var(--gray-400)' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {members.length === 0 && invitations.length === 0 && (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>Vous êtes seul pour l'instant</div>
            <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>Invitez vos praticiens et assistants pour partager l'accès</div>
            <button onClick={() => setShowInvite(true)} className="btn-primary">+ Inviter un membre</button>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          clinicId={clinicId}
          currentUserId={currentUserId}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); load() }}
        />
      )}
    </div>
  )
}

function InviteModal({ clinicId, currentUserId, onClose, onCreated }: any) {
  const supabase = createClient()
  const [form, setForm] = useState({ email:'', role:'assistant' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('team_invitations').insert({
      clinic_id: clinicId,
      email: form.email,
      role: form.role,
      invited_by: currentUserId,
    })
    if (err) { setError(err.message); setLoading(false) }
    else onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Inviter un membre</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#B91C1C' }}>{error}</div>}
            <div>
              <label className="label">Adresse email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="docteur@clinique.fr" />
            </div>
            <div>
              <label className="label">Rôle *</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {Object.entries(ROLE_CFG).map(([id, cfg]) => (
                  <label key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${form.role===id ? cfg.color : 'var(--gray-200)'}`, background: form.role===id ? cfg.bg : 'white', transition:'all .1s' }}>
                    <input type="radio" name="role" value={id} checked={form.role===id} onChange={() => setForm(f => ({ ...f, role: id }))} style={{ display:'none' }} />
                    <span style={{ fontSize:18 }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:600, color: form.role===id ? cfg.color : 'var(--gray-900)' }}>{cfg.label}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--blue-light)', border:'1px solid var(--blue-mid)', borderRadius:8, padding:'10px 12px', fontSize:12, color:'var(--blue-dark)', display:'flex', gap:8 }}>
              <span>ℹ️</span>
              Un lien d'invitation sera créé. Copiez-le et envoyez-le à votre collaborateur.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Création...' : 'Créer l\'invitation'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
