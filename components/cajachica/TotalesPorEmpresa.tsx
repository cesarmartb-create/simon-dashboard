import { formatCLP } from '@/lib/utils'

interface Props {
  filas: { empresa: string; total: number }[]
  preliminar?: boolean
}

/**
 * Subtotales por empresa (guia de reposicion: una transferencia por empresa).
 * En borrador/en_revision es PRELIMINAR (suma todos los gastos); al cerrar/pagar
 * suma solo los APROBADOS. Los gastos sin empresa van como "Sin asignar".
 */
export default function TotalesPorEmpresa({ filas, preliminar = false }: Props) {
  if (filas.length === 0) return null
  return (
    <section className="bg-white border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {preliminar ? 'Totales por empresa (preliminar)' : 'Totales por empresa'}
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        {preliminar
          ? 'Suma de todos los gastos cargados (aun no aprobados).'
          : 'Suma de gastos aprobados; una transferencia por empresa.'}
      </p>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {filas.map((f) => (
            <tr key={f.empresa}>
              <td className="py-2 text-gray-700">{f.empresa}</td>
              <td className="py-2 text-right text-gray-900 whitespace-nowrap">
                {formatCLP(f.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
