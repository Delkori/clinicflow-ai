'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function PatientsPage() {
  const supabase = createClient()
  const [patients, setPatients]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [total, setTotal]         = useState(0)

  const load = useCallback(async () => {
    let q = supabase.from('patients').select('*', { count:'exact' }).order('created_at', { ascending: false })
    if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (filterSource !== 'all') q = q.eq('source', filterSource)
    const { data, count } = await q
    setPatients(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterSource])

  useEffect(() => { load() }, [load])

  const doctolibCount = patients.filter(p => p.source === 'doctolib').length

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="page-title">Patients</div>
          <div className="page-subtitle">{total} patient{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/dashboard/patients/doctolib" className="btn-secondary" style={{ textDecoration:'none', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
            📅 Patients Doctolib
          </Link>
          <Link href="/dashboard/import" className="btn-secondary" style={{ textDecoration:'none', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
            📄 Import CSV
          </Link>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize:13 }}>
            + Nouveau patient
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Search + Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:200, maxWidth:380 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)', fontSize:14, pointerEvents:'none' }}>🔍</span>
            <input className="input" type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, prénom, email..." style={{ paddingLeft:36 }} />
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {(['all','manual','doctolib'] as const).map(s => (
              <button key={s} onClick={() => setFilterSource(s)} style={{ padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', background: filterSource===s ? 'var(--blue)' : 'white', color: filterSource===s ? 'white' : 'var(--gray-600)', border: filterSource===s ? 'none' : '1px solid var(--gray-200)' }}>
                {s === 'all' ? `Tous (${total})` : s === 'doctolib' ? `📅 Doctolib (${doctolibCount})` : '✋ Manuel'}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ width:28, height:28, border:'3px solid var(--gray-200)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>◎</div>
              <div style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)', marginBottom:6 }}>
                {search || filterSource !== 'all' ? 'Aucun patient trouvé' : 'Aucun patient encore'}
              </div>
              <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:20 }}>
                {search ? 'Essayez avec un autre terme' : 'Importez depuis Doctolib ou créez votre premier patient'}
              </div>
              {!search && (
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <Link href="/dashboard/import" className="btn-secondary" style={{ textDecoration:'none', fontSize:13 }}>📅 Import Doctolib</Link>
                  <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize:13 }}>+ Nouveau patient</button>
                </div>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Naissance</th>
                  <th>Source</th>
                  <th>Ajouté le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="avatar" style={{ width:34, height:34, fontSize:12, fontWeight:700 }}>
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:500, color:'var(--gray-900)' }}>{p.first_name} {p.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize:13, color:'var(--gray-700)' }}>{p.email || '—'}</div>
                      <div style={{ fontSize:12, color:'var(--gray-500)' }}>{p.phone || ''}</div>
                    </td>
                    <td style={{ fontSize:13, color:'var(--gray-600)' }}>{p.date_of_birth ? formatDate(p.date_of_birth) : '—'}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:99, background: p.source==='doctolib' ? 'var(--blue-light)' : 'var(--gray-100)', color: p.source==='doctolib' ? 'var(--blue-dark)' : 'var(--gray-600)' }}>
                        {p.source === 'doctolib' ? '📅 Doctolib' : '✋ Manuel'}
                      </span>
                    </td>
                    <td style={{ fontSize:13, color:'var(--gray-500)' }}>{formatDate(p.created_at)}</td>
                    <td>
                      <Link href={`/dashboard/patients/${p.id}`} style={{ color:'var(--blue)', fontSize:13, fontWeight:500, textDecoration:'none' }}>Voir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <NewPatientModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

function NewPatientModal({ onClose, onCreated }: { onClose:()=>void; onCreated:()=>void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', date_of_birth:'', source:'manual', notes:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const up = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[k]:e.target.value}))

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) return
    const { data:prof } = await supabase.from('profiles').select('clinic_id').eq('id',user.id).single()
    if (!prof) return
    const { error } = await supabase.from('patients').insert({ ...form, clinic_id:prof.clinic_id, date_of_birth:form.date_of_birth||null })
    if (error) { setError(error.message); setLoading(false) }
    else onCreated()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nouveau patient</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--gray-400)', lineHeight:1 }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:13 }}>
            {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#B91C1C' }}>{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={up('first_name')} required placeholder="Marie" /></div>
              <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={up('last_name')} required placeholder="Dupont" /></div>
            </div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={up('email')} placeholder="marie@email.fr" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="label">Téléphone</label><input className="input" type="tel" value={form.phone} onChange={up('phone')} placeholder="06 12 34 56 78" /></div>
              <div><label className="label">Date de naissance</label><input className="input" type="date" value={form.date_of_birth} onChange={up('date_of_birth')} /></div>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={form.source} onChange={up('source')}>
                <option value="manual">✋ Manuel</option>
                <option value="doctolib">📅 Doctolib</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div><label className="label">Notes</label><textarea className="input" value={form.notes} onChange={up('notes')} rows={2} style={{ resize:'none' }} /></div>
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
