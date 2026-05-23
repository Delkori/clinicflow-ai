'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function NewTemplatePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/documents/templates/new-doc') }, [])
  return null
}
