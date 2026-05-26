import type { EstadoCaso } from '@/types/caso'
import { ESTADO_LABEL } from '@/types/caso'

const ESTILO: Record<EstadoCaso, string> = {
  abierto: 'bg-gray-100 text-gray-700 border-gray-300',
  en_gestion: 'bg-blue-50 text-blue-700 border-blue-300',
  esperando_empleado: 'bg-amber-50 text-amber-700 border-amber-300',
  cerrado: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  escalado: 'bg-red-50 text-red-700 border-red-300',
}

interface Props {
  estado: EstadoCaso | string | null
}

export default function EstadoBadge({ estado }: Props) {
  const e = (estado ?? 'abierto') as EstadoCaso
  const estilo = ESTILO[e] ?? ESTILO.abierto
  const label = ESTADO_LABEL[e] ?? e

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${estilo}`}
    >
      {label}
    </span>
  )
}
