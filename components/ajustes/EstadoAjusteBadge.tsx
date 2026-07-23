import type { EstadoAjuste } from '@/types/ajuste'
import { ESTADO_AJUSTE_LABEL } from '@/types/ajuste'

const ESTILO: Record<EstadoAjuste, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-300',
  validado: 'bg-blue-50 text-blue-700 border-blue-300',
  realizado: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  anulado: 'bg-red-50 text-red-700 border-red-300',
}

interface Props {
  estado: EstadoAjuste | string | null
}

export default function EstadoAjusteBadge({ estado }: Props) {
  const e = (estado ?? 'pendiente') as EstadoAjuste
  const estilo = ESTILO[e] ?? ESTILO.pendiente
  const label = ESTADO_AJUSTE_LABEL[e] ?? e

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${estilo}`}
    >
      {label}
    </span>
  )
}
