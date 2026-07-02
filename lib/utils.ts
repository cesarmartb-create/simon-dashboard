export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFechaHora(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function diasEntre(desde: string, hasta: string | null = null): number {
  const d1 = new Date(desde).getTime()
  const d2 = hasta ? new Date(hasta).getTime() : Date.now()
  return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)))
}

export function promedioHoras(diferencias: number[]): number {
  if (diferencias.length === 0) return 0
  const total = diferencias.reduce((a, b) => a + b, 0)
  return total / diferencias.length
}

export function formatCLP(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto)
}
