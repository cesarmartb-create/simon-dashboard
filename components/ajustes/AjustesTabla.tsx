import Link from 'next/link'
import type { AjusteInventario } from '@/types/ajuste'
import { DIRECCION_AJUSTE_LABEL } from '@/types/ajuste'
import EstadoAjusteBadge from './EstadoAjusteBadge'
import { formatFechaCorta, formatCLP, diasEntre, cn } from '@/lib/utils'

export type AjusteConTipo = AjusteInventario & {
  tipos_ajuste: { nombre: string } | null
}

const DIAS_ALERTA = 15

interface Props {
  ajustes: AjusteConTipo[]
}

export default function AjustesTabla({ ajustes }: Props) {
  if (ajustes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay ajustes que coincidan con los filtros.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Local</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Dirección</th>
            <th className="px-4 py-3 font-medium text-right">Cant. SKU</th>
            <th className="px-4 py-3 font-medium text-right">Monto</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium text-right">Días</th>
            <th className="px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ajustes.map((ajuste) => {
            const dias = diasEntre(ajuste.created_at)
            // Abierto = pendiente o validado: ambos envejecen y alertan.
            const abierto =
              ajuste.estado === 'pendiente' || ajuste.estado === 'validado'
            const alerta = abierto && dias > DIAS_ALERTA
            return (
              <tr
                key={ajuste.id}
                className={cn(
                  'transition-colors',
                  alerta ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
                )}
              >
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatFechaCorta(ajuste.created_at)}
                </td>
                <td className="px-4 py-3 text-gray-700">{ajuste.local}</td>
                <td className="px-4 py-3 text-gray-700">
                  {ajuste.tipos_ajuste?.nombre ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      ajuste.direccion === 'alta'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }
                  >
                    {DIRECCION_AJUSTE_LABEL[ajuste.direccion] ?? ajuste.direccion}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {ajuste.cantidad_sku}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                  {formatCLP(ajuste.monto)}
                </td>
                <td className="px-4 py-3">
                  <EstadoAjusteBadge estado={ajuste.estado} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right whitespace-nowrap',
                    alerta ? 'font-semibold text-amber-700' : 'text-gray-500'
                  )}
                >
                  {abierto ? dias : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ajustes/${ajuste.id}`}
                    className="text-accent text-xs font-medium hover:underline"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
