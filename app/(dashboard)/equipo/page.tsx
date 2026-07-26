import Header from '@/components/layout/Header'
import { requireVistaGlobal } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { hoyChile, formatCLP } from '@/lib/utils'
// gestores se derivan de areas_derivacion (correo real), no del mapa hardcodeado
import {
  ESTADOS,
  ESTADO_LABEL,
  CATEGORIAS,
  type Caso,
  type EstadoCaso,
} from '@/types/caso'
import type { EstadoAjuste } from '@/types/ajuste'
import type { EstadoRendicion } from '@/types/cajachica'

/** 'YYYY-MM' de una fecha ISO, en zona America/Santiago (para cortes de mes). */
function mesChile(fechaIso: string): string {
  return new Date(fechaIso)
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .slice(0, 7)
}

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
    .select('nombre, responsable_nombre, responsable_correo')
    .eq('cliente_id', 'grupobaco')
    .eq('activo', true)
    .order('orden', { ascending: true })

  const areas = (areasData ?? []) as {
    nombre: string
    responsable_nombre: string
    responsable_correo: string
  }[]

  // Categorias reales de caso (excluye ajustes_inventario/caja_chica: esas
  // areas no reciben casos, tienen sus propias secciones mas abajo).
  const categoriasDeCaso = new Set(CATEGORIAS.map((c) => c.value))

  // Un responsable por correo (dedup: un mismo correo puede cubrir varias areas).
  const gestoresPorCorreo = new Map<string, string>()
  for (const a of areas) {
    if (!categoriasDeCaso.has(a.nombre)) continue
    if (a.responsable_correo && !gestoresPorCorreo.has(a.responsable_correo)) {
      gestoresPorCorreo.set(a.responsable_correo, a.responsable_nombre)
    }
  }

  const mesActual = hoyChile().slice(0, 7)

  const { data: ajustesData } = await supabase
    .from('ajustes_inventario')
    .select('estado, created_at, fecha_validacion, fecha_cierre')

  const ajustes = (ajustesData ?? []) as {
    estado: EstadoAjuste
    created_at: string
    fecha_validacion: string | null
    fecha_cierre: string | null
  }[]

  const ajustesRealizados = ajustes.filter((a) => a.estado === 'realizado')
  const horasAjuste = ajustesRealizados
    .filter((a) => a.fecha_validacion && a.fecha_cierre)
    .map(
      (a) =>
        (new Date(a.fecha_cierre as string).getTime() -
          new Date(a.fecha_validacion as string).getTime()) /
        (1000 * 60 * 60)
    )

  const resumenAjustes = {
    pendientes: ajustes.filter((a) => a.estado === 'pendiente').length,
    porEjecutar: ajustes.filter((a) => a.estado === 'validado').length,
    ejecutorNombre:
      areas.find((a) => a.nombre === 'ajustes_inventario')?.responsable_nombre ??
      null,
    realizadosMes: ajustesRealizados.filter(
      (a) => a.fecha_cierre && mesChile(a.fecha_cierre) === mesActual
    ).length,
    anulados: ajustes.filter((a) => a.estado === 'anulado').length,
    promedioHoras:
      horasAjuste.length > 0
        ? horasAjuste.reduce((a, b) => a + b, 0) / horasAjuste.length
        : null,
  }

  const { data: rendicionesData } = await supabase
    .from('rendiciones_caja_chica')
    .select('estado, total, created_at, fecha_pago')

  const rendiciones = (rendicionesData ?? []) as {
    estado: EstadoRendicion
    total: number
    created_at: string
    fecha_pago: string | null
  }[]

  const porPagar = rendiciones.filter(
    (r) =>
      (r.estado === 'aprobada' || r.estado === 'aprobada_parcial') &&
      !r.fecha_pago
  )
  const pagadasMes = rendiciones.filter(
    (r) =>
      r.estado === 'pagado' &&
      r.fecha_pago &&
      mesChile(r.fecha_pago) === mesActual
  )

  const resumenCajaChica = {
    porRevisar: rendiciones.filter((r) => r.estado === 'en_revision').length,
    revisoraNombre:
      areas.find((a) => a.nombre === 'caja_chica')?.responsable_nombre ?? null,
    porPagarCount: porPagar.length,
    porPagarMonto: porPagar.reduce((s, r) => s + Number(r.total ?? 0), 0),
    pagadasMesCount: pagadasMes.length,
    pagadasMesMonto: pagadasMes.reduce((s, r) => s + Number(r.total ?? 0), 0),
    rechazadas: rendiciones.filter((r) => r.estado === 'rechazada').length,
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
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Carga del equipo
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Casos, Ajustes y Caja Chica — cola de trabajo por área, no
            asignación individual (salvo Casos, que sí se asigna por gestor).
          </p>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Casos</h3>
          <p className="text-sm text-gray-500 mb-4">
            Casos asignados a cada gestor y su rendimiento.
          </p>

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
        </section>

        <section className="bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Ajustes</h3>
          <p className="text-sm text-gray-500 mb-4">
            Cola de trabajo del área, no asignación individual.
          </p>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Pendientes</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {resumenAjustes.pendientes}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">
                Por ejecutar
                {resumenAjustes.ejecutorNombre
                  ? ` (cola actual: ${resumenAjustes.ejecutorNombre})`
                  : ''}
              </dt>
              <dd className="text-lg font-semibold text-accent">
                {resumenAjustes.porEjecutar}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Realizados este mes</dt>
              <dd className="text-lg font-semibold text-emerald-700">
                {resumenAjustes.realizadosMes}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Anulados</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {resumenAjustes.anulados}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Prom. validado → realizado</dt>
              <dd className="text-lg font-semibold text-gray-700">
                {resumenAjustes.promedioHoras === null
                  ? '—'
                  : resumenAjustes.promedioHoras < 24
                    ? `${resumenAjustes.promedioHoras.toFixed(1)} h`
                    : `${(resumenAjustes.promedioHoras / 24).toFixed(1)} d`}
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Caja Chica
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Cola de trabajo del área, no asignación individual.
          </p>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500">
                Por revisar
                {resumenCajaChica.revisoraNombre
                  ? ` (cola actual: ${resumenCajaChica.revisoraNombre})`
                  : ''}
              </dt>
              <dd className="text-lg font-semibold text-accent">
                {resumenCajaChica.porRevisar}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Por pagar</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {resumenCajaChica.porPagarCount}
                <span className="block text-xs font-normal text-gray-500">
                  {formatCLP(resumenCajaChica.porPagarMonto)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Pagadas este mes</dt>
              <dd className="text-lg font-semibold text-emerald-700">
                {resumenCajaChica.pagadasMesCount}
                <span className="block text-xs font-normal text-gray-500">
                  {formatCLP(resumenCajaChica.pagadasMesMonto)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Rechazadas</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {resumenCajaChica.rechazadas}
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </>
  )
}
