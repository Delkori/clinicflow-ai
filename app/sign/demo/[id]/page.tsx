import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function DemoSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: req } = await supabase
    .from('document_sign_requests')
    .select('*, patient:patients(first_name, last_name), clinic:clinics(name)')
    .eq('id', id)
    .single()

  if (!req) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <h1 style={{ fontSize:20 }}>Document introuvable</h1>
      </div>
    </div>
  )

  const clinicName = (req as any).clinic?.name ?? 'Votre Clinique'
  const patientName = `${(req as any).patient?.first_name} ${(req as any).patient?.last_name}`

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'20px 24px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, background:'#0596DE', borderRadius:7 }} />
        <div style={{ color:'white', fontWeight:700, fontSize:14 }}>{clinicName}</div>
        <div style={{ marginLeft:'auto', fontSize:11, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.08)', padding:'2px 8px', borderRadius:99 }}>
          ⚠️ Mode démo — Yousign non configuré
        </div>
      </div>

      <div style={{ maxWidth:720, margin:'32px auto', padding:'0 24px' }}>
        {/* Demo warning */}
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', gap:12 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#92400E', marginBottom:4 }}>Mode démonstration</div>
            <div style={{ fontSize:13, color:'#92400E', lineHeight:1.6 }}>
              Yousign n'est pas encore configuré. En production, cette page serait remplacée par l'interface de signature officielle Yousign avec validation légale.
              <br />
              <strong>Pour activer :</strong> Ajoutez <code style={{ background:'#FEF9C3', padding:'1px 5px', borderRadius:3 }}>YOUSIGN_API_KEY</code> dans Vercel → Settings → Environment Variables.
            </div>
          </div>
        </div>

        {/* Document preview */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>{req.name}</div>
              <div style={{ fontSize:13, color:'#64748B', marginTop:2 }}>Pour : {patientName}</div>
            </div>
            <span style={{ fontSize:11, fontWeight:700, background:'#FFFBEB', color:'#D97706', padding:'3px 10px', borderRadius:99 }}>Signature requise</span>
          </div>
          <div style={{ padding:24, maxHeight:500, overflow:'auto' }}
            dangerouslySetInnerHTML={{ __html: req.html_content ?? '<p>Contenu indisponible</p>' }} />
        </div>

        {/* Sign button (demo) */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'#0F172A', marginBottom:6 }}>Signature électronique</div>
          <div style={{ fontSize:13, color:'#64748B', marginBottom:20 }}>
            En production, vous signeriez ici avec validation par code SMS ou email selon le niveau de sécurité configuré.
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <DemoSignButton requestId={id} />
            <Link href="/" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'12px', borderRadius:9, border:'1px solid #E2E8F0', color:'#64748B', textDecoration:'none', fontSize:13, fontWeight:500 }}>
              Refuser
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoSignButton({ requestId }: { requestId: string }) {
  return (
    <form action={`/api/documents/sign-demo?id=${requestId}`} method="POST" style={{ flex:2 }}>
      <button type="submit"
        style={{ width:'100%', padding:'13px', borderRadius:9, border:'none', background:'#6B21A8', color:'white', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        ✍️ Signer le document (démo)
      </button>
    </form>
  )
}
