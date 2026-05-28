import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(request: NextRequest) {
  const clinic_id = request.nextUrl.searchParams.get('clinic_id')
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id required' }, { status: 400 })
  const supabase = getSupabase()
  const { data, count } = await supabase
    .from('notifications')
    .select('*, patient:patients(first_name, last_name)', { count: 'exact' })
    .eq('clinic_id', clinic_id)
    .order('created_at', { ascending: false })
    .limit(20)
  const unread = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic_id).eq('is_read', false)
  return NextResponse.json({ notifications: data ?? [], total: count, unread_count: unread.count ?? 0 })
}

export async function POST(request: NextRequest) {
  const { clinic_id, type, title, message, link, patient_id } = await request.json()
  const supabase = getSupabase()
  const { data } = await supabase.from('notifications').insert({ clinic_id, type, title, message, link, patient_id }).select().single()
  return NextResponse.json({ success: true, notification: data })
}

export async function PATCH(request: NextRequest) {
  const { clinic_id, id } = await request.json()
  const supabase = getSupabase()
  if (id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  } else {
    await supabase.from('notifications').update({ is_read: true }).eq('clinic_id', clinic_id)
  }
  return NextResponse.json({ success: true })
}
