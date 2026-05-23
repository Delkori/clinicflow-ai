import { createClient } from '@supabase/supabase-js'
import BookingClient from './BookingClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: settings } = await supabase
    .from('booking_settings')
    .select('*, clinic:clinics(name), treatments:treatments(id, name, color, description)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!settings) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F172A', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ textAlign:'center', color:'white' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
        <h1 style={{ fontSize:20, fontWeight:600, marginBottom:8 }}>Page introuvable</h1>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14 }}>Ce lien de prise de rendez-vous n'existe pas ou a été désactivé.</p>
      </div>
    </div>
  )

  return <BookingClient settings={settings} />
}
