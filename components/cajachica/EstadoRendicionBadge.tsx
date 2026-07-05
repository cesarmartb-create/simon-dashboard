import type { EstadoRendicion } from '@/types/cajachica'
import { ESTADO_RENDICION_LABEL } from '@/types/cajachica'

const ESTILO: Record<EstadoRendicion, string> = {
  abierto: 'bg-slate-50 text-slate-700 border-slate-300',
  en_revision: 'bg-amber-50 text-amber-700 border-amber-300',
  aprobada: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  aprobada_parcial: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  rechazada: 'bg-red-50 text-red-700 border-red-300',
  pagado: 'bg-indigo-50 text-indigo-700 border-indigo-300',
}

interface Props {
  estado: EstadoRendicion | string | null
}

export default function EstadoRendicionBadge({ estado }: Props) {
  const e = (estado ?? 'abierto') as EstadoRendicion
  const estilo = ESTILO[e] ?? ESTILO.abierto
  const label = ESTADO_RENDICION_LABEL[e] ?? e

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${estilo}`}
    >
      {label}
    </span>
  )
}
