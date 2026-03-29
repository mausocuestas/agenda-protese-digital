import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Calcula idade em anos a partir de uma data ISO (yyyy-mm-dd) */
export function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/** Calcula dias desde uma data ISO (yyyy-mm-dd) até hoje */
export function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.floor(ms / 86_400_000)
}

/** Formata dias em texto legível: "2 anos e 3 meses" ou "45 dias" */
export function formatQueueTime(days: number): string {
  if (days < 30) return `${days} dia${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mês${months !== 1 ? 'es' : ''}`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (remMonths === 0) return `${years} ano${years !== 1 ? 's' : ''}`
  return `${years} ano${years !== 1 ? 's' : ''} e ${remMonths} mês${remMonths !== 1 ? 'es' : ''}`
}
