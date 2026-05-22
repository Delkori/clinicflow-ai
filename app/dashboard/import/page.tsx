'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Doctolib export columns mapping
const DOCTOLIB_COLUMNS: Record<string, string> = {
  'Prénom': 'first_name',
  'Nom': 'last_name',
  'Civilité': 'civility',
  'Date de naissance': 'date_of_birth',
  'E-mail': 'email',
  'Email': 'email',
  'Téléphone portable': 'phone',
  'Téléphone': 'phone',
  'Téléphone secondaire': 'phone2',
  'Adresse': 'address',
  'Code postal': 'postal_code',
  'Ville': 'city',
  'Type d\'assurance': 'insurance_type',
  'Profession': 'profession',
  'Notes': 'notes',
  'Remarque': 'notes',
  'Identifiant Externe': 'external_id',
  'Id': 'doctolib_id',
  'Doctolib Patient ID': 'doctolib_id',
  'Motif du RDV': 'appointment_reason',
  'Nom du médecin traitant': 'referring_doctor',
}

interface ParsedRow {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  date_of_birth?: string
  address?: string
  city?: string
  postal_code?: string
  notes?: string
  doctolib_id?: string
  insurance_type?: string
  profession?: string
  [key: string]: string | undefined
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  // Detect separator (comma or semicolon)
  const sep = lines[0].includes(';') ? ';' : ','

  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? '' }), {} as Record<string, string>)
  })
  return { headers, rows }
}

function mapDoctolibRow(row: Record<string, string>): ParsedRow {
  const mapped: ParsedRow = {}
  for (const [col, val] of Object.entries(row)) {
    const key = DOCTOLIB_COLUMNS[col]
    if (key && val && val !== 'null' && val !== '') {
      if (key === 'notes' && mapped.notes) {
        mapped.notes = mapped.notes + ' | ' + val
      } else {
        mapped[key] = val
      }
    }
  }
  // Normalize date format DD/MM/YYYY → YYYY-MM-DD
  if (mapped.date_of_birth) {
    const parts = mapped.date_of_birth.split('/')
    if (parts.length === 3) {
      mapped.date_of_birth = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }
  // Normalize phone
  if (mapped.phone) {
    mapped.phone = mapped.phone.replace(/\s/g, '').replace(/^00/, '+')
  }
  return mapped
}

export default function ImportPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [allRows, setAllRows] = useState<ParsedRow[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 })
  const [duplicates, setDuplicates] = useState<number>(0)

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    const text = await file.text()
    const { headers: h, rows } = parseCSV(text)
    setHeaders(h)
    const mapped = rows.map(mapDoctolibRow).filter(r => r.first_name || r.last_name)
    setAllRows(mapped)
    setPreview(mapped.slice(0, 8))
    setSelectedRows(new Set(mapped.map((_, i) => i)))
    setStep('preview')
  }, [])

  const handleFile = (file: File) => {
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const toggleRow = (i: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === allRows.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(allRows.map((_, i) => i)))
  }

  async function handleImport() {
    setStep('importing')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (!profile) return

    const toImport = allRows.filter((_, i) => selectedRows.has(i))
    setProgress({ done: 0, total: toImport.length, errors: 0 })
    let errors = 0
    let dupes = 0

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i]
      if (!row.first_name && !row.last_name) continue

      // Check duplicate by email or name
      if (row.email) {
        const { data: existing } = await supabase.from('patients').select('id').eq('email', row.email).eq('clinic_id', profile.clinic_id).maybeSingle()
        if (existing) { dupes++; setProgress(p => ({ ...p, done: p.done + 1 })); continue }
      }

      // Build notes with extra fields
      const extraNotes = [
        row.insurance_type ? `Assurance: ${row.insurance_type}` : '',
        row.profession ? `Profession: ${row.profession}` : '',
        row.address ? `Adresse: ${row.address}${row.postal_code ? ' ' + row.postal_code : ''}${row.city ? ' ' + row.city : ''}` : '',
      ].filter(Boolean).join(' | ')

      const notes = [row.notes, extraNotes].filter(Boolean).join(' | ')

      const { error } = await supabase.from('patients').insert({
        clinic_id: profile.clinic_id,
        first_name: row.first_name ?? '',
        last_name: row.last_name ?? '',
        email: row.email || null,
        phone: row.phone || null,
        date_of_birth: row.date_of_birth || null,
        notes: notes || null,
        source: 'doctolib',
      })
      if (error) errors++
      setProgress(p => ({ ...p, done: p.done + 1, errors: p.errors + (error ? 1 : 0) }))

      // Small delay to avoid rate limiting
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 100))
    }
    setDuplicates(dupes)
    setProgress(p => ({ ...p, errors }))
    setStep('done')
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/patients" style={{ color: 'var(--gray-400)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Patients
          </Link>
          <span style={{ color: 'var(--gray-300)' }}>/</span>
          <div className="page-title">Import Doctolib</div>
        </div>
        <span className="badge badge-blue">📅 Doctolib</span>
      </div>

      <div className="page-content" style={{ maxWidth: '860px' }}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          {[
            { id: 'upload', label: 'Fichier' },
            { id: 'preview', label: 'Vérification' },
            { id: 'importing', label: 'Import' },
            { id: 'done', label: 'Terminé' },
          ].map((s, i, arr) => {
            const steps = ['upload', 'preview', 'importing', 'done']
            const current = steps.indexOf(step)
            const idx = steps.indexOf(s.id)
            const done = idx < current
            const active = idx === current
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '600',
                    background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--gray-100)',
                    color: done || active ? 'white' : 'var(--gray-400)',
                    border: active ? '2px solid var(--blue-mid)' : 'none',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: active ? '600' : '400', color: active ? 'var(--gray-900)' : done ? 'var(--gray-600)' : 'var(--gray-400)' }}>{s.label}</span>
                </div>
                {i < arr.length - 1 && <span style={{ color: 'var(--gray-300)', fontSize: '12px', marginLeft: '4px' }}>—</span>}
              </div>
            )
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div>
            {/* Info banner */}
            <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '14px' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--blue-dark)', marginBottom: '6px' }}>Comment exporter vos patients depuis Doctolib</div>
                <ol style={{ fontSize: '13px', color: 'var(--blue-dark)', paddingLeft: '16px', lineHeight: '1.8' }}>
                  <li>Connectez-vous à votre espace <strong>Doctolib Pro</strong></li>
                  <li>Allez dans <strong>Paramètres → Exports de données</strong></li>
                  <li>Sélectionnez <strong>"Base patients"</strong> et cliquez <strong>Exporter</strong></li>
                  <li>Téléchargez le fichier <strong>.csv ou .xlsx</strong> reçu par email</li>
                  <li>Uploadez-le ci-dessous ⬇️</li>
                </ol>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--blue)' : 'var(--gray-200)'}`,
                borderRadius: '16px',
                padding: '60px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'var(--blue-light)' : 'white',
                transition: 'all 0.15s',
              }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📥</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '6px' }}>
                Glissez votre export Doctolib ici
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '20px' }}>
                Formats acceptés : CSV, Excel (.xlsx, .xls)
              </div>
              <div className="btn-primary" style={{ display: 'inline-flex' }}>
                Choisir un fichier
              </div>
            </div>

            {/* Format hint */}
            <div className="card" style={{ padding: '16px 20px', marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray-600)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Colonnes Doctolib reconnues automatiquement
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Prénom', 'Nom', 'Civilité', 'Date de naissance', 'E-mail', 'Téléphone portable', 'Adresse', 'Code postal', 'Ville', 'Notes', 'Type d\'assurance', 'Profession', 'Motif du RDV'].map(col => (
                  <span key={col} className="badge badge-gray">{col}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--gray-900)' }}>
                  {allRows.length} patients détectés dans <span style={{ color: 'var(--blue)' }}>{fileName}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>
                  {selectedRows.size} sélectionné{selectedRows.size > 1 ? 's' : ''} pour l'import
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => { setStep('upload'); setAllRows([]); setPreview([]) }} className="btn-secondary" style={{ fontSize: '13px' }}>
                  ← Autre fichier
                </button>
                <button onClick={handleImport} disabled={selectedRows.size === 0} className="btn-primary">
                  Importer {selectedRows.size} patient{selectedRows.size > 1 ? 's' : ''} →
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input type="checkbox" checked={selectedRows.size === allRows.length} onChange={toggleAll}
                        style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                    </th>
                    <th>Patient</th>
                    <th>Contact</th>
                    <th>Naissance</th>
                    <th>Ville</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(allRows.length > 8 ? allRows : preview).map((row, i) => (
                    <tr key={i} style={{ opacity: selectedRows.has(i) ? 1 : 0.4 }}>
                      <td>
                        <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)}
                          style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>
                            {row.first_name?.[0] ?? '?'}{row.last_name?.[0] ?? '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--gray-900)' }}>
                              {row.first_name} {row.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--gray-700)' }}>{row.email || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{row.phone || ''}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--gray-600)' }}>{row.date_of_birth || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--gray-600)' }}>{[row.city, row.postal_code].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ fontSize: '11px', color: 'var(--gray-500)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allRows.length > 8 && (
                <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', fontSize: '12px', color: 'var(--gray-500)', textAlign: 'center' }}>
                  Aperçu des {allRows.length} patients — tous seront importés si sélectionnés
                </div>
              )}
            </div>

            {/* Dedup notice */}
            <div style={{ marginTop: '12px', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12px', color: '#92400E', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>⚠️</span>
              Les patients avec le même email que ceux déjà existants seront ignorés automatiquement (dédoublonnage).
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 24px' }}>
              <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', width: '80px', height: '80px' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--gray-100)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--blue)" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - (progress.total > 0 ? progress.done / progress.total : 0))}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'var(--gray-900)' }}>
                {progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0}%
              </div>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Import en cours...</div>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{progress.done} / {progress.total} patients traités</div>
            <div style={{ maxWidth: '320px', margin: '16px auto 0', background: 'var(--gray-100)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--blue)', borderRadius: '4px', width: `${progress.total > 0 ? (progress.done / progress.total * 100) : 0}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', background: 'var(--green-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>✅</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '8px' }}>Import terminé !</div>
            <div style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '28px' }}>
              Voici le résumé de l'opération
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
              <div style={{ background: 'var(--green-light)', borderRadius: '12px', padding: '16px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#059669' }}>{progress.done - progress.errors - duplicates}</div>
                <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px' }}>Importés</div>
              </div>
              {duplicates > 0 && (
                <div style={{ background: '#FFFBEB', borderRadius: '12px', padding: '16px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#D97706' }}>{duplicates}</div>
                  <div style={{ fontSize: '12px', color: '#D97706', marginTop: '2px' }}>Doublons ignorés</div>
                </div>
              )}
              {progress.errors > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '16px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#B91C1C' }}>{progress.errors}</div>
                  <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>Erreurs</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => { setStep('upload'); setAllRows([]); setFileName(''); setSelectedRows(new Set()) }} className="btn-secondary">
                Importer un autre fichier
              </button>
              <Link href="/dashboard/patients" className="btn-primary" style={{ textDecoration: 'none' }}>
                Voir mes patients →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
