'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function AutomationsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/automations-v2') }, [])
  return null
}
