import Link from 'next/link'
import type { RendicionCajaChica } from '@/types/cajachica'
import EstadoRendicionBadge from './EstadoRendicionBadge'
import { formatCLP, cn } from '@/lib/utils'

interface Props {
  rendiciones: RendicionCajaChica[]
}

export default function RendicionesTabla({ rendiciones }: Props) {
  if (rendiciones.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay rendiciones que coincidan con los filtros.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="px-4 py-3 font-medium">Periodo</th>
            <th className="px-4 py-3 font-medium text-right">N°</th>
            <th className="px-4 py-3 font-medium">Local</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium">Fondo</th>
            <th className="px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rendiciones.map((r) => (
            <tr
              key={r.id}
              className={cn(
                'transition-colors',
                r.excede_fondo ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
              )}
            >
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                {r.periodo}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">{r.numero}</td>
              <td className="px-4 py-3 text-gray-700">{r.local}</td>
              <td className="px-4 py-3">
                <EstadoRendicionBadge estado={r.estado} />
              </td>
              <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                {formatCLP(r.total)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {r.excede_fondo ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300">
                    Excede fondo
                  </span>
                ) : r.monto_fondo_snapshot != null ? (
                  <span className="text-xs text-gray-500">
                    {formatCLP(r.monto_fondo_snapshot)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Sin fondo</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/caja-chica/${r.id}`}
                  className="text-accent text-xs font-medium hover:underline"
                >
                  Ver →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
