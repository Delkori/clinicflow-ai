'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', clinic_name: '', role: 'medecin' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, clinic_name: form.clinic_name, role: form.role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })
    if (error) { setError(error.message); setLoading(false) }
    else setSuccess(true)
  }

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✉️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
        <p className="text-gray-500 text-sm">Un lien de confirmation a été envoyé à <strong>{form.email}</strong></p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">CF</span>
            </div>
            <span className="text-white font-bold text-2xl">ClinicFlow AI</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Créer votre clinique</h1>
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom complet</label>
                <input type="text" value={form.full_name} onChange={update('full_name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Dr. Martin" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                <select value={form.role} onChange={update('role')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="medecin">Médecin</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la clinique</label>
              <input type="text" value={form.clinic_name} onChange={update('clinic_name')} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Clinique Esthétique Paris" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={update('email')} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={form.password} onChange={update('password')} required minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="8 caractères minimum" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {loading ? 'Création...' : 'Créer mon espace clinique'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Déjà un compte ? <Link href="/auth/login" className="text-violet-600 hover:underline font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
