import { ESTADO_LABEL, type EstadoCaso } from '@/types/caso'

interface Props {
  conteo: Record<EstadoCaso, number>
  total: number
}

const COLOR: Record<EstadoCaso, string> = {
  abierto: 'bg-gray-400',
  en_gestion: 'bg-blue-500',
  esperando_empleado: 'bg-amber-500',
  cerrado: 'bg-emerald-500',
  escalado: 'bg-red-500',
}

export default function DistribucionEstados({ conteo, total }: Props) {
  const estados = Object.keys(conteo) as EstadoCaso[]

  return (
    <div className="bg-white border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Distribución por estado
      </h3>
      <div className="space-y-3">
        {estados.map((e) => {
          const valor = conteo[e]
          const pct = total > 0 ? Math.round((valor / total) * 100) : 0
          return (
            <div key={e}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-gray-700">{ESTADO_LABEL[e]}</span>
                <span className="text-gray-500">
                  {valor} ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 overflow-hidden">
                <div
                  className={`h-full ${COLOR[e]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
