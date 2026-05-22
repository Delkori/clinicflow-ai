'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    let q = supabase.from('patients').select('*').order('created_at', { ascending: false })
    if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    const { data } = await q
    setPatients(data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Patients</div>
          <div className="page-subtitle">{patients.length} patient{patients.length > 1 ? 's' : ''} enregistré{patients.length > 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Nouveau patient</button>
      </div>

      <div className="page-content">
        {/* Search */}
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '14px' }}>🔍</span>
          <input className="input" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un patient par nom, email..." style={{ paddingLeft: '36px', maxWidth: '400px' }} />
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>◎</div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--gray-700)', marginBottom: '6px' }}>Aucun patient</div>
              <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '20px' }}>Ajoutez votre premier patient pour commencer</div>
              <button onClick={() => setShowModal(true)} className="btn-primary">+ Ajouter un patient</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Date de naissance</th>
                  <th>Source</th>
                  <th>Ajouté le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '12px' }}>{p.first_name[0]}{p.last_name[0]}</div>
                        <div>
                          <div style={{ fontWeight: '500', color: 'var(--gray-900)', fontSize: '14px' }}>{p.first_name} {p.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{p.email || '—'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{p.phone || ''}</div>
                    </td>
                    <td style={{ color: 'var(--gray-600)', fontSize: '13px' }}>{p.date_of_birth ? formatDate(p.date_of_birth) : '—'}</td>
                    <td>
                      <span className={`badge ${p.source === 'doctolib' ? 'badge-blue' : 'badge-gray'}`}>
                        {p.source === 'doctolib' ? '📅 Doctolib' : '✋ Manuel'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>{formatDate(p.created_at)}</td>
                    <td>
                      <Link href={`/dashboard/patients/${p.id}`} style={{ color: 'var(--blue)', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Voir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && <NewPatientModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function NewPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', source: 'manual', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!profile) return
    const { error } = await supabase.from('patients').insert({ ...form, clinic_id: profile.clinic_id, date_of_birth: form.date_of_birth || null })
    if (error) { setError(error.message); setLoading(false) } else onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau patient</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--gray-400)' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B91C1C' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={update('first_name')} required /></div>
              <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={update('last_name')} required /></div>
            </div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={update('email')} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className="label">Téléphone</label><input className="input" type="tel" value={form.phone} onChange={update('phone')} /></div>
              <div><label className="label">Date de naissance</label><input className="input" type="date" value={form.date_of_birth} onChange={update('date_of_birth')} /></div>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={form.source} onChange={update('source')}>
                <option value="manual">Manuel</option>
                <option value="doctolib">Doctolib</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div><label className="label">Notes</label><textarea className="input" value={form.notes} onChange={update('notes')} rows={2} style={{ resize: 'none' }} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Création...' : 'Créer le patient'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
