import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dcbcfxekkjjaktbunikr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjYmNmeGVra2pqYWt0YnVuaWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MzUyNzIsImV4cCI6MjA5NTAxMTI3Mn0.CpWXytKh79u4NpJw4KOZof0kk6ZIFiARK3KZT6vSTgM',
  },
}

export default nextConfig
