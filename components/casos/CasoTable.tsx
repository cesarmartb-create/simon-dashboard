import Link from 'next/link'
import type { Caso } from '@/types/caso'
import EstadoBadge from './EstadoBadge'
import { formatFechaCorta } from '@/lib/utils'

interface Props {
  casos: Caso[]
  mostrarResponsable?: boolean
}

export default function CasoTable({ casos, mostrarResponsable = true }: Props) {
  if (casos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay casos que coincidan con los filtros.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="px-4 py-3 font-medium">Colaborador</th>
            <th className="px-4 py-3 font-medium">Local</th>
            <th className="px-4 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 font-medium">Consulta</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            {mostrarResponsable && (
              <th className="px-4 py-3 font-medium">Responsable</th>
            )}
            <th className="px-4 py-3 font-medium">Creado</th>
            <th className="px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {casos.map((caso) => (
            <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {caso.reportado_por ?? caso.colaborador_nombre ?? '—'}
                </div>
                {caso.colaborador_nombre &&
                  caso.colaborador_nombre !== caso.reportado_por && (
                    <div className="text-xs text-gray-500">
                      Afectado: {caso.colaborador_nombre}
                    </div>
                  )}
              </td>
              <td className="px-4 py-3 text-gray-700">{caso.local ?? '—'}</td>
              <td className="px-4 py-3 text-gray-700">
                {caso.categoria ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-700 max-w-xs">
                <div className="truncate" title={caso.consulta ?? ''}>
                  {caso.consulta ?? '—'}
                </div>
              </td>
              <td className="px-4 py-3">
                <EstadoBadge estado={caso.estado} />
              </td>
              {mostrarResponsable && (
                <td className="px-4 py-3 text-gray-700">
                  {caso.responsable ?? '—'}
                </td>
              )}
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {formatFechaCorta(caso.fecha_creacion ?? caso.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/casos/${caso.id}`}
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
