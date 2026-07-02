import Link from 'next/link'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { formatCLP, cn } from '@/lib/utils'

interface Props {
  searchParams: {
    desde?: string
    hasta?: string
  }
}

interface FilaResumen {
  local: string
  direccion: string
  monto: number | null
  tipos_ajuste: { nombre: string; orden: number | null } | null
}

export default async function ResumenAjustesPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()
  if (usuario.rol !== 'admin') redirect('/ajustes')

  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? 'grupobaco'

  // Default: año en curso.
  const hoy = new Date()
  const desde = searchParams.desde || `${hoy.getFullYear()}-01-01`
  const hasta = searchParams.hasta || hoy.toISOString().slice(0, 10)

  // Solo columnas necesarias para el agregado (server-side, no filas completas).
  const { data: rowsData, error } = await supabase
    .from('ajustes_inventario')
    .select('local, direccion, monto, tipos_ajuste(nombre, orden)')
    .eq('cliente_id', clienteId)
    .eq('estado', 'realizado')
    .gte('fecha_cierre', desde)
    .lte('fecha_cierre', `${hasta}T23:59:59.999`)

  const rows = (rowsData ?? []) as unknown as FilaResumen[]

  // Pivote: filas = tipo, columnas = local; alta suma, baja resta.
  const tipoOrden = new Map<string, number>()
  const localesSet = new Set<string>()
  const celdas = new Map<string, number>()
  const totalPorTipo = new Map<string, number>()
  const totalPorLocal = new Map<string, number>()
  let granTotal = 0

  for (const r of rows) {
    const tipo = r.tipos_ajuste?.nombre ?? '—'
    if (!tipoOrden.has(tipo)) tipoOrden.set(tipo, r.tipos_ajuste?.orden ?? 999)
    localesSet.add(r.local)
    const valor = (r.direccion === 'baja' ? -1 : 1) * (r.monto ?? 0)
    const key = `${tipo}|${r.local}`
    celdas.set(key, (celdas.get(key) ?? 0) + valor)
    totalPorTipo.set(tipo, (totalPorTipo.get(tipo) ?? 0) + valor)
    totalPorLocal.set(r.local, (totalPorLocal.get(r.local) ?? 0) + valor)
    granTotal += valor
  }

  const tipos = Array.from(tipoOrden.keys()).sort(
    (a, b) => (tipoOrden.get(a) ?? 999) - (tipoOrden.get(b) ?? 999)
  )
  const locales = Array.from(localesSet).sort()

  function celda(valor: number | undefined) {
    if (valor === undefined) return <span className="text-gray-300">—</span>
    return (
      <span className={cn(valor < 0 && 'text-red-700')}>
        {formatCLP(valor)}
      </span>
    )
  }

  return (
    <>
      <Header usuario={usuario} titulo="Resumen de ajustes" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Ajustes realizados por tipo y local
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Suma de montos con signo (alta suma, baja resta), según fecha de
              cierre.
            </p>
          </div>
          <Link
            href="/ajustes"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a ajustes
          </Link>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Aplicar
          </button>
        </form>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando el resumen: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
            No hay ajustes realizados en el rango seleccionado.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  {locales.map((l) => (
                    <th
                      key={l}
                      className="px-4 py-3 font-medium text-right whitespace-nowrap"
                    >
                      {l}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-right bg-gray-100">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tipos.map((tipo) => (
                  <tr key={tipo} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tipo}
                    </td>
                    {locales.map((l) => (
                      <td
                        key={l}
                        className="px-4 py-3 text-right whitespace-nowrap"
                      >
                        {celda(celdas.get(`${tipo}|${l}`))}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium bg-gray-50 whitespace-nowrap">
                      {celda(totalPorTipo.get(tipo))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    Total
                  </td>
                  {locales.map((l) => (
                    <td
                      key={l}
                      className="px-4 py-3 text-right font-medium whitespace-nowrap"
                    >
                      {celda(totalPorLocal.get(l))}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold bg-gray-100 whitespace-nowrap">
                    {celda(granTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
