'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'white' }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px', maxWidth: '480px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '64px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--blue)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>ClinicFlow AI</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--gray-900)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Bon retour 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '36px' }}>
            Connectez-vous à votre espace clinique
          </p>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#B91C1C', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Adresse email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="docteur@clinique.fr" />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', justifyContent: 'center', padding: '11px' }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '24px', textAlign: 'center' }}>
            Pas encore de compte ?{' '}
            <Link href="/auth/signup" style={{ color: 'var(--blue)', fontWeight: '500', textDecoration: 'none' }}>
              Créer un espace clinique
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: 'var(--blue)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ position: 'relative', padding: '48px', maxWidth: '420px' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', marginBottom: '32px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🩺</div>
              <div>
                <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>Dr. Sarah Martin</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>Clinique Esthétique Paris</div>
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic' }}>
              "ClinicFlow AI a transformé ma façon de gérer les consultations. Le gain de temps est incroyable."
            </div>
          </div>

          <h2 style={{ color: 'white', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '16px', lineHeight: '1.3' }}>
            Orchestrez le parcours patient avec l'IA
          </h2>

          {[
            { icon: '🎙️', text: 'Transcription automatique des consultations' },
            { icon: '⚙️', text: 'Workflows post-opératoires automatisés' },
            { icon: '💬', text: 'Suivi patient par email & WhatsApp' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>{item.icon}</div>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: '500' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
