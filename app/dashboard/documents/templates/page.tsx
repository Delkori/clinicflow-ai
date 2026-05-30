'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function TemplatesListPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/documents') }, [])
  return null
}
