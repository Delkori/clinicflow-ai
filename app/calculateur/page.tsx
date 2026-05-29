'use client'
import { useState } from 'react'
import Link from 'next/link'

const POLES = [
  {
    id: 'medecine',
    label: 'Médecine esthétique',
    color: '#4F8EF7',
    lightColor: '#EFF6FF',
    icon: '💉',
    traitements: [
      { label: 'Injections HA',        pct: 32, nbMois: 45, prix: 450  },
      { label: 'Toxine botulinique',   pct: 28, nbMois: 40, prix: 350  },
      { label: 'Skinbooster / Méso',   pct: 22, nbMois: 30, prix: 280  },
      { label: 'Peeling chimique',     pct: 18, nbMois: 25, prix: 300  },
    ],
  },
  {
    id: 'chirurgie',
    label: 'Chirurgie esthétique',
    color: '#22C55E',
    lightColor: '#F0FDF4',
    icon: '🔬',
    traitements: [
      { label: 'Rhinoplastie',         pct: 25, nbMois: 8,  prix: 5500 },
      { label: 'Blépharoplastie',      pct: 20, nbMois: 10, prix: 3200 },
      { label: 'Augmentation sein',    pct: 30, nbMois: 12, prix: 6500 },
      { label: 'Liposuccion',          pct: 25, nbMois: 8,  prix: 4000 },
    ],
  },
  {
    id: 'laser',
    label: 'Bien-être & Laser',
    color: '#E879B0',
    lightColor: '#FFF0F7',
    icon: '✨',
    traitements: [
      { label: 'Épilation laser',      pct: 40, nbMois: 120, prix: 180 },
      { label: 'Laser CO2 fractionné', pct: 20, nbMois: 25,  prix: 800 },
      { label: 'IPL / Photorejuv.',    pct: 25, nbMois: 35,  prix: 350 },
      { label: 'Cryolipolyse',         pct: 15, nbMois: 20,  prix: 600 },
    ],
  },
  {
    id: 'capillaire',
    label: 'Capillaire',
    color: '#F59E0B',
    lightColor: '#FFFBEB',
    icon: '💈',
    traitements: [
      { label: 'Greffe FUE',           pct: 50, nbMois: 12, prix: 3500 },
      { label: 'PRP capillaire',       pct: 25, nbMois: 25, prix: 400  },
      { label: 'Thérapie médicale',    pct: 15, nbMois: 30, prix: 200  },
      { label: 'Microblading',         pct: 10, nbMois: 20, prix: 350  },
    ],
  },
]

const TRAITEMENT_COLORS = [
  '#93C5FD','#6EE7B7','#F9A8D4','#FCD34D',
  '#A5B4FC','#34D399','#F472B6','#FBBF24',
  '#7DD3FC','#86EFAC','#F0ABFC','#FDE68A',
  '#BAE6FD','#BBF7D0','#E9D5FF','#FEF3C7',
]

export default function CalculateurPage() {
  const [activePoles, setActivePoles] = useState(new Set(['medecine', 'laser']))
  const [nbPatients, setNbPatients] = useState(80)
  const [tauxRetour, setTauxRetour] = useState(45)

  function togglePole(id: string) {
    const next = new Set(activePoles)
    if (next.has(id)) {
      if (next.size === 1) return
      next.delete(id)
    } else {
      next.add(id)
    }
    setActivePoles(next)
  }

  const effectif = nbPatients * (1 + tauxRetour / 100)

  // Calcul des données par traitement
  type TraitData = {
    label: string; pole: string; poleLabel: string; poleColor: string;
    nbAnnuel: number; caAnnuel: number; pct: number; color: string;
  }

  const allData: TraitData[] = []
  let colorIdx = 0
  let totalCA = 0

  POLES.filter(p => activePoles.has(p.id)).forEach(pole => {
    pole.traitements.forEach(t => {
      const nb = Math.round(effectif * (t.pct / 100))
      const ca = nb * t.prix * 12
      totalCA += ca
      allData.push({
        label: t.label,
        pole: pole.id,
        poleLabel: pole.label,
        poleColor: pole.color,
        nbAnnuel: nb * 12,
        caAnnuel: ca,
        pct: t.pct,
        color: TRAITEMENT_COLORS[colorIdx++ % TRAITEMENT_COLORS.length],
      })
    })
  })

  // Sort by CA
  allData.sort((a, b) => b.caAnnuel - a.caAnnuel)

  // Group by pole for left side
  const poleData = POLES.filter(p => activePoles.has(p.id)).map(pole => {
    const traitements = allData.filter(d => d.pole === pole.id)
    const poleCA = traitements.reduce((s, d) => s + d.caAnnuel, 0)
    return { ...pole, caAnnuel: poleCA, traitements }
  }).sort((a, b) => b.caAnnuel - a.caAnnuel)

  const maxCA = Math.max(...allData.map(d => d.caAnnuel), 1)
  const fmt = (n: number) => n >= 1000000
    ? (n / 1000000).toFixed(1) + ' M€'
    : n >= 1000 ? Math.round(n / 1000) + ' k€'
    : Math.round(n) + ' €'

  // SVG Sankey dimensions
  const W = 760, H = Math.max(400, allData.length * 44 + 60)
  const leftX = 0, leftW = 160
  const rightX = W - 180, rightW = 180
  const midX = leftW + 20

  // Positions for left (poles)
  let poleY = 40
  const poleRects: Record<string, { y: number; h: number }> = {}
  poleData.forEach(pole => {
    const h = Math.max(40, Math.round((pole.caAnnuel / totalCA) * (H - 80)))
    poleRects[pole.id] = { y: poleY, h }
    poleY += h + 12
  })

  // Positions for right (traitements)
  let tratY = 20
  const tratRects: Record<string, { y: number; h: number }> = {}
  allData.forEach(d => {
    const h = Math.max(36, Math.round((d.caAnnuel / totalCA) * (H - 80)))
    tratRects[d.label] = { y: tratY, h }
    tratY += h + 10
  })

  // Sankey paths
  type SankeyPath = { d: string; fill: string; opacity: number }
  const sankeyPaths: SankeyPath[] = []

  poleData.forEach(pole => {
    const pr = poleRects[pole.id]
    if (!pr) return
    let outY = pr.y

    pole.traitements.forEach(trt => {
      const tr = tratRects[trt.label]
      if (!tr) return
      const srcH = Math.max(4, Math.round((trt.caAnnuel / totalCA) * (H - 80)))
      const dstH = tr.h

      const x1 = leftW, y1 = outY + srcH / 2
      const x2 = rightX, y2 = tr.y + dstH / 2
      const cx = (x1 + x2) / 2

      const d = `M ${x1} ${outY}
        C ${cx} ${outY}, ${cx} ${tr.y}, ${x2} ${tr.y}
        L ${x2} ${tr.y + dstH}
        C ${cx} ${tr.y + dstH}, ${cx} ${outY + srcH}, ${x1} ${outY + srcH} Z`

      sankeyPaths.push({ d, fill: trt.color, opacity: 0.55 })
      outY += srcH
    })
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 32px', display: 'flex', alignItems: 'center', height: 58, gap: 12 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, background: '#0596DE', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>ClinicFlow AI</span>
        </Link>
        <span style={{ color: '#CBD5E1' }}>›</span>
        <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Visualisation des traitements</span>
        <div style={{ flex: 1 }} />
        <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 600, color: 'white', background: '#0596DE', borderRadius: 8, padding: '7px 16px', textDecoration: 'none' }}>
          Essai gratuit →
        </Link>
      </nav>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', color: '#0F172A', marginBottom: 8 }}>
            Répartition de votre activité
          </h1>
          <p style={{ fontSize: 15, color: '#64748B' }}>
            Visualisez les flux de revenus de votre clinique — pôles, traitements et volumes.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Panneau gauche — contrôles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pôles */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Pôles actifs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {POLES.map(pole => {
                  const active = activePoles.has(pole.id)
                  return (
                    <button key={pole.id} onClick={() => togglePole(pole.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${active ? pole.color : '#E2E8F0'}`, background: active ? pole.lightColor : 'white', transition: 'all .12s', textAlign: 'left' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? pole.color : '#CBD5E1', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#0F172A' : '#64748B' }}>{pole.icon} {pole.label}</div>
                        {active && poleData.find(p => p.id === pole.id) && (
                          <div style={{ fontSize: 11, color: pole.color, marginTop: 1 }}>
                            {fmt(poleData.find(p => p.id === pole.id)!.caAnnuel)}/an
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: active ? pole.color : '#94A3B8' }}>
                        {active ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Paramètres */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>Paramètres</div>
              {[
                { label: 'Patients / mois', val: nbPatients, set: setNbPatients, min: 10, max: 300, step: 5, display: nbPatients.toString() },
                { label: 'Taux de retour', val: tauxRetour, set: setTauxRetour, min: 10, max: 80, step: 5, display: tauxRetour + '%' },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{s.display}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => s.set(+e.target.value)}
                    style={{ width: '100%', accentColor: '#0596DE' }} />
                </div>
              ))}
            </div>

            {/* KPIs */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Projection annuelle</div>
              {[
                { label: 'CA total', value: fmt(totalCA), color: '#0596DE' },
                { label: 'CA mensuel', value: fmt(totalCA / 12), color: '#059669' },
                { label: 'Traitements/an', value: Math.round(allData.reduce((s, d) => s + d.nbAnnuel, 0)).toLocaleString('fr-FR'), color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F8FAFC' }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{k.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{k.value}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ background: '#0F172A', borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 4 }}>Gérez votre activité</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>Workflows · Analytics · Patients</div>
              <Link href="/auth/signup" style={{ display: 'block', padding: '9px', background: '#0596DE', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Démarrer gratuitement →
              </Link>
            </div>
          </div>

          {/* Sankey + liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Sankey SVG */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Flux de revenus</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>projection 12 mois · {fmt(totalCA)}</div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: W }}>
                  {/* Paths Sankey */}
                  {sankeyPaths.map((p, i) => (
                    <path key={i} d={p.d} fill={p.fill} opacity={p.opacity} />
                  ))}

                  {/* Poles (gauche) */}
                  {poleData.map(pole => {
                    const r = poleRects[pole.id]
                    if (!r) return null
                    return (
                      <g key={pole.id}>
                        <rect x={leftX} y={r.y} width={leftW} height={r.h} fill={pole.color} rx={6} />
                        <text x={leftW / 2} y={r.y + r.h / 2 - 6} textAnchor="middle" fill="white" fontSize={11} fontWeight="700" fontFamily="-apple-system,sans-serif">
                          {pole.label.length > 16 ? pole.label.slice(0, 15) + '…' : pole.label}
                        </text>
                        <text x={leftW / 2} y={r.y + r.h / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={10} fontFamily="-apple-system,sans-serif">
                          {fmt(pole.caAnnuel)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Traitements (droite) */}
                  {allData.map((d, i) => {
                    const r = tratRects[d.label]
                    if (!r) return null
                    const bgColor = d.color
                    return (
                      <g key={d.label}>
                        <rect x={rightX} y={r.y} width={6} height={r.h} fill={d.poleColor} rx={2} />
                        <rect x={rightX + 10} y={r.y} width={rightW - 12} height={r.h} fill="#F8FAFC" rx={5} />
                        <text x={rightX + 18} y={r.y + r.h / 2 - 5} fill="#0F172A" fontSize={10} fontWeight="600" fontFamily="-apple-system,sans-serif">
                          {d.label.length > 20 ? d.label.slice(0, 19) + '…' : d.label}
                        </text>
                        <text x={rightX + 18} y={r.y + r.h / 2 + 8} fill="#64748B" fontSize={10} fontFamily="-apple-system,sans-serif">
                          {fmt(d.caAnnuel)}
                        </text>
                        <rect x={rightX + rightW - 4} y={r.y} width={4} height={r.h} fill={bgColor} rx={2} />
                      </g>
                    )
                  })}

                  {/* Labels colonnes */}
                  <text x={leftW / 2} y={18} textAnchor="middle" fill="#94A3B8" fontSize={9} fontWeight="700" fontFamily="-apple-system,sans-serif" letterSpacing="1">
                    PÔLES
                  </text>
                  <text x={rightX + rightW / 2} y={12} textAnchor="middle" fill="#94A3B8" fontSize={9} fontWeight="700" fontFamily="-apple-system,sans-serif" letterSpacing="1">
                    TRAITEMENTS
                  </text>
                </svg>
              </div>
            </div>

            {/* Tableau détaillé */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Détail par traitement</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>trié par CA annuel</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Traitement', 'Pôle', 'Actes/an', '% activité', 'CA annuel', 'Part du CA'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #E2E8F0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allData.map((d, i) => {
                    const part = totalCA > 0 ? Math.round(d.caAnnuel / totalCA * 100) : 0
                    return (
                      <tr key={d.label} style={{ borderBottom: i < allData.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{d.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: d.poleColor, background: `${d.poleColor}15`, padding: '2px 7px', borderRadius: 99 }}>
                            {d.poleLabel.split(' ')[0]}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#475569' }}>
                          {d.nbAnnuel.toLocaleString('fr-FR')}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 60, height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(d.pct, 100)}%`, background: d.poleColor, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748B' }}>{d.pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                          {fmt(d.caAnnuel)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 70, height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${part}%`, background: d.color, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#475569' }}>{part}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                    <td colSpan={4} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Total</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 800, color: '#0596DE' }}>{fmt(totalCA)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
