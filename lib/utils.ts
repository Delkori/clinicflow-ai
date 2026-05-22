import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function timingLabel(days: number, reference: string) {
  const ref = reference === 'intervention' ? 'interv.' : 'consult.'
  if (days === 0) return `Jour ${ref}`
  if (days > 0) return `J+${days} ${ref}`
  return `J${days} ${ref}`
}

export const STEP_TYPE_LABELS: Record<string, string> = {
  email: '📧 Email',
  whatsapp: '💬 WhatsApp',
  document: '📄 Document',
  docusign: '✍️ DocuSign',
  sms: '📱 SMS',
}

export const STEP_TYPE_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  document: 'bg-gray-100 text-gray-700',
  docusign: 'bg-purple-100 text-purple-700',
  sms: 'bg-yellow-100 text-yellow-700',
}
