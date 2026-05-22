'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', clinic_name: '', role: 'medecin' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()
  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, clinic_name: form.clinic_name, role: form.role }, emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setLoading(false) } else setSuccess(true)
  }

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '400px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
        <div style={{ width: '60px', height: '60px', background: 'var(--blue-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px' }}>✉️</div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Vérifiez votre email</h2>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Un lien de confirmation a été envoyé à <strong>{form.email}</strong></p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'white' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--blue)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--gray-900)' }}>ClinicFlow AI</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '6px' }}>Créez votre clinique</h1>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '32px' }}>Commencez votre essai gratuit en 2 minutes</p>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#B91C1C', marginBottom: '20px' }}>{error}</div>}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className="label">Nom complet *</label><input className="input" value={form.full_name} onChange={update('full_name')} required placeholder="Dr. Martin" /></div>
              <div>
                <label className="label">Rôle</label>
                <select className="input" value={form.role} onChange={update('role')}>
                  <option value="medecin">Médecin</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>
            <div><label className="label">Nom de la clinique *</label><input className="input" value={form.clinic_name} onChange={update('clinic_name')} required placeholder="Clinique Esthétique Paris" /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={update('email')} required /></div>
            <div><label className="label">Mot de passe *</label><input className="input" type="password" value={form.password} onChange={update('password')} required minLength={8} placeholder="8 caractères minimum" /></div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', justifyContent: 'center', padding: '11px' }}>
              {loading ? 'Création...' : 'Créer mon espace clinique →'}
            </button>
          </form>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '24px', textAlign: 'center' }}>
            Déjà un compte ? <Link href="/auth/login" style={{ color: 'var(--blue)', fontWeight: '500', textDecoration: 'none' }}>Se connecter</Link>
          </p>
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--gray-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{ maxWidth: '380px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--blue)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Tout inclus dès le départ</div>
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '32px', lineHeight: '1.35' }}>Un outil pensé pour les cliniques esthétiques modernes</h2>
          {[
            { icon: '🩺', title: 'CRM patient complet', desc: 'Fiche patient, historique, timeline' },
            { icon: '🎙️', title: 'IA pour vos consultations', desc: 'Transcription et structuration automatique' },
            { icon: '⚙️', title: 'Workflows automatisés', desc: 'Email, WhatsApp, DocuSign en pilote auto' },
            { icon: '📊', title: 'Tableau de bord clinique', desc: 'KPIs et analytics en temps réel' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(5,150,222,0.15)', border: '1px solid rgba(5,150,222,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ color: 'white', fontSize: '13.5px', fontWeight: '500', marginBottom: '2px' }}>{f.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
