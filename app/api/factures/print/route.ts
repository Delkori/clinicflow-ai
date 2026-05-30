import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: f } = await supabase
    .from('factures')
    .select('*, patient:patients(first_name, last_name, email, phone, date_of_birth), clinic:clinics(name)')
    .eq('id', id)
    .single()

  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const clinicName = f.clinic?.name ?? 'Ma Clinique'
  const patient = f.patient
  const lignes: any[] = f.lignes ?? []

  const lignesHtml = lignes.map((l: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px">${l.code ? `<span style="font-family:monospace;color:#64748b;font-size:11px">${l.code}</span><br>` : ''}${l.acte || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center">${l.quantite ?? 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right">${Number(l.prix_ht || 0).toFixed(2)} €</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center">${l.tva_pct ?? 20}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;text-align:right">${Number(l.prix_ttc || 0).toFixed(2)} €</td>
    </tr>
  `).join('')

  const statusLabel: Record<string, string> = {
    brouillon: 'BROUILLON', envoyee: 'ENVOYÉE', payee: 'PAYÉE', annulee: 'ANNULÉE', retard: 'RETARD'
  }
  const statusColor: Record<string, string> = {
    brouillon: '#6B7280', envoyee: '#0891B2', payee: '#059669', annulee: '#6B7280', retard: '#DC2626'
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${f.numero} — ${clinicName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: white; padding: 40px; max-width: 760px; margin: 0 auto; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <!-- Print button -->
  <div class="no-print" style="text-align:right;margin-bottom:24px">
    <button onclick="window.print()" style="padding:10px 22px;background:#0f172a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🖨️ Imprimer / PDF</button>
  </div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:2px solid #0f172a;margin-bottom:28px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:4px">${clinicName}</div>
      <div style="font-size:13px;color:#64748b">Médecine esthétique</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">FACTURE</div>
      <div style="font-size:16px;font-weight:700;color:#0596DE;font-family:monospace;margin-top:4px">${f.numero}</div>
      <div style="margin-top:8px">
        <span style="font-size:12px;font-weight:700;color:${statusColor[f.status] ?? '#6B7280'};background:${f.status === 'payee' ? '#ecfdf5' : '#f3f4f6'};padding:3px 10px;border-radius:99px">
          ${statusLabel[f.status] ?? f.status.toUpperCase()}
        </span>
      </div>
    </div>
  </div>

  <!-- Patient + Dates -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div style="background:#f8fafc;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Patient</div>
      <div style="font-size:15px;font-weight:700">${patient?.first_name ?? ''} ${patient?.last_name ?? ''}</div>
      ${patient?.email ? `<div style="font-size:12px;color:#64748b;margin-top:3px">${patient.email}</div>` : ''}
      ${patient?.phone ? `<div style="font-size:12px;color:#64748b">${patient.phone}</div>` : ''}
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Dates</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;color:#64748b">Émission</span>
        <span style="font-size:13px;font-weight:500">${f.date_emission ? new Date(f.date_emission).toLocaleDateString('fr-FR') : '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;color:#64748b">Échéance</span>
        <span style="font-size:13px;font-weight:500">${f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '—'}</span>
      </div>
      ${f.date_paiement ? `<div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:#059669">✓ Paiement</span>
        <span style="font-size:13px;font-weight:600;color:#059669">${new Date(f.date_paiement).toLocaleDateString('fr-FR')}</span>
      </div>` : ''}
    </div>
  </div>

  <!-- Lines table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Prestation</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Qté</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Prix HT</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">TVA</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Prix TTC</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:260px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9">
        <span style="font-size:13px;color:#64748b">Total HT</span>
        <span style="font-size:13px;font-weight:500">${Number(f.total_ht ?? 0).toFixed(2)} €</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9">
        <span style="font-size:13px;color:#64748b">TVA (20%)</span>
        <span style="font-size:13px;font-weight:500">${Number(f.total_tva ?? 0).toFixed(2)} €</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #0f172a;margin-top:4px">
        <span style="font-size:16px;font-weight:700">Total TTC</span>
        <span style="font-size:20px;font-weight:900;color:#0596DE">${Number(f.total_ttc ?? 0).toFixed(2)} €</span>
      </div>
      ${f.moyen_paiement ? `<div style="font-size:12px;color:#059669;margin-top:6px;text-align:right">✓ Réglé par ${f.moyen_paiement === 'cb' ? 'CB' : f.moyen_paiement === 'especes' ? 'Espèces' : f.moyen_paiement === 'cheque' ? 'Chèque' : 'Virement'}</div>` : ''}
    </div>
  </div>

  <!-- Legal -->
  <div style="padding:14px;background:#f8fafc;border-radius:8px;border-left:3px solid #e2e8f0">
    <div style="font-size:11px;color:#94a3b8;font-style:italic">
      ${f.mention_legale ?? 'Esthétique médicale non remboursée par l\'Assurance Maladie'}
    </div>
    ${f.notes ? `<div style="font-size:12px;color:#64748b;margin-top:6px">${f.notes}</div>` : ''}
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:11px;color:#94a3b8">Généré par ClinicFlow AI</div>
    <div style="font-size:11px;color:#94a3b8">${clinicName} · ${f.numero}</div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    }
  })
}
