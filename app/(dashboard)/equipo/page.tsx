import Header from '@/components/layout/Header'
import { requireVistaGlobal } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
// gestores se derivan de areas_derivacion (correo real), no del mapa hardcodeado
import { ESTADOS, ESTADO_LABEL, type Caso, type EstadoCaso } from '@/types/caso'

interface ResumenGestor {
  nombre: string
  total: number
  porEstado: Record<EstadoCaso, number>
  cerrados: number
  abiertos: number
  promedioHoras: number | null
}

export default async function EquipoPage() {
  const usuario = await requireVistaGlobal()
  const supabase = createClient()

  const { data: casosData } = await supabase.from('casos').select('*')
  const casos = (casosData ?? []) as Caso[]

  const { data: areasData } = await supabase
    .from('areas_derivacion')
    .select('responsable_nombre, responsable_correo')
    .eq('cliente_id', 'grupobaco')
    .eq('activo', true)
    .order('orden', { ascending: true })

  const areas = (areasData ?? []) as {
    responsable_nombre: string
    responsable_correo: string
  }[]

  // Un responsable por correo (dedup: un mismo correo puede cubrir varias areas).
  const gestoresPorCorreo = new Map<string, string>()
  for (const a of areas) {
    if (a.responsable_correo && !gestoresPorCorreo.has(a.responsable_correo)) {
      gestoresPorCorreo.set(a.responsable_correo, a.responsable_nombre)
    }
  }

  const resumen: ResumenGestor[] = Array.from(gestoresPorCorreo.entries()).map(
    ([correo, nombre]) => {
      const propios = casos.filter((c) => c.responsable === correo)
    const cerrados = propios.filter((c) => c.estado === 'cerrado')
    const horasCierre = cerrados
      .filter((c) => c.fecha_creacion && c.fecha_cierre)
      .map(
        (c) =>
          (new Date(c.fecha_cierre as string).getTime() -
            new Date(c.fecha_creacion as string).getTime()) /
          (1000 * 60 * 60)
      )

    const promedio =
      horasCierre.length > 0
        ? horasCierre.reduce((a, b) => a + b, 0) / horasCierre.length
        : null

    const porEstado = ESTADOS.reduce(
      (acc, e) => {
        acc[e] = propios.filter((c) => c.estado === e).length
        return acc
      },
      {} as Record<EstadoCaso, number>
    )

    return {
      nombre,
      total: propios.length,
      porEstado,
      cerrados: cerrados.length,
      abiertos: propios.filter((c) => c.estado !== 'cerrado').length,
      promedioHoras: promedio,
      }
    }
  )

  return (
    <>
      <Header usuario={usuario} titulo="Equipo" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Carga del equipo
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Casos asignados a cada gestor y su rendimiento.
          </p>
        </div>

        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 font-medium">Gestor</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Abiertos</th>
                <th className="px-4 py-3 font-medium text-right">Cerrados</th>
                {ESTADOS.map((e) => (
                  <th
                    key={e}
                    className="px-3 py-3 font-medium text-right whitespace-nowrap"
                  >
                    {ESTADO_LABEL[e]}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">
                  Prom. cierre
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumen.map((r) => (
                <tr key={r.nombre} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.nombre}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {r.total}
                  </td>
                  <td className="px-4 py-3 text-right text-accent font-medium">
                    {r.abiertos}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {r.cerrados}
                  </td>
                  {ESTADOS.map((e) => (
                    <td
                      key={e}
                      className="px-3 py-3 text-right text-gray-700"
                    >
                      {r.porEstado[e]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {r.promedioHoras === null
                      ? '—'
                      : r.promedioHoras < 24
                        ? `${r.promedioHoras.toFixed(1)} h`
                        : `${(r.promedioHoras / 24).toFixed(1)} d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
