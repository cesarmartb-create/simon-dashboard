import { createClient } from '@/lib/supabase/server'
import { puedeVerAjustes } from '@/lib/ajustes'
import { formatCLP, diasEntre } from '@/lib/utils'
import type { Usuario } from '@/types/usuario'

interface FilaAjuste {
  estado: string
  created_at: string
  fecha_cierre: string | null
  monto: number | null
  direccion: string
  local: string
  tipos_ajuste: { nombre: string } | null
}

const DIAS_ALERTA = 15

function Card({
  titulo,
  valor,
  subtitulo,
  tono,
}: {
  titulo: string
  valor: string | number
  subtitulo?: string
  tono?: 'alerta' | 'negativo'
}) {
  const color =
    tono === 'alerta'
      ? 'text-amber-600'
      : tono === 'negativo'
        ? 'text-red-700'
        : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-200 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {titulo}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${color}`}>{valor}</div>
      {subtitulo && (
        <div className="mt-1 text-xs text-gray-500">{subtitulo}</div>
      )}
    </div>
  )
}

export default async function SeccionAjustes({
  usuario,
}: {
  usuario: Usuario
}) {
  // Mismo gate que el listado: si no puede ver ajustes, la sección no aparece.
  if (!puedeVerAjustes(usuario)) return null

  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? 'grupobaco'

  // Mismo filtrado por rol que el listado (policies permisivas).
  let query = supabase
    .from('ajustes_inventario')
    .select(
      'estado, created_at, fecha_cierre, monto, direccion, local, tipos_ajuste(nombre)'
    )
    .eq('cliente_id', clienteId)

  if (usuario.rol === 'qf') {
    query = query.eq('local', usuario.local ?? '')
  }

  const { data } = await query
  const ajustes = (data ?? []) as unknown as FilaAjuste[]

  const ahora = new Date()
  const pendientes = ajustes.filter((a) => a.estado === 'pendiente')
  const realizados = ajustes.filter((a) => a.estado === 'realizado')

  // Card 1: pendientes + antigüedad del más antiguo.
  const maxDias = pendientes.reduce(
    (m, a) => Math.max(m, diasEntre(a.created_at)),
    0
  )
  const alertaPendientes = pendientes.length > 0 && maxDias > DIAS_ALERTA
  const subtextoPendientes =
    pendientes.length === 0
      ? 'Sin pendientes'
      : `el más antiguo lleva ${maxDias} día${maxDias === 1 ? '' : 's'}`

  // Card 2: realizados con fecha_cierre del mes en curso.
  const realizadosMes = realizados.filter((a) => {
    if (!a.fecha_cierre) return false
    const f = new Date(a.fecha_cierre)
    return (
      f.getFullYear() === ahora.getFullYear() &&
      f.getMonth() === ahora.getMonth()
    )
  })

  // Card 3: promedio histórico en días entre creación y cierre.
  const diasRealizacion = realizados
    .filter((a) => a.fecha_cierre)
    .map(
      (a) =>
        (new Date(a.fecha_cierre as string).getTime() -
          new Date(a.created_at).getTime()) /
        86400000
    )
  const promedioDias =
    diasRealizacion.length > 0
      ? diasRealizacion.reduce((x, y) => x + y, 0) / diasRealizacion.length
      : null

  // Card 4: monto neto con signo, realizados con cierre del año en curso.
  const montoNetoAno = realizados
    .filter(
      (a) =>
        a.fecha_cierre &&
        new Date(a.fecha_cierre).getFullYear() === ahora.getFullYear()
    )
    .reduce(
      (sum, a) => sum + (a.direccion === 'baja' ? -1 : 1) * (a.monto ?? 0),
      0
    )

  // Distribución: pendientes por tipo.
  const porTipo = pendientes.reduce<Record<string, number>>((acc, a) => {
    const t = a.tipos_ajuste?.nombre ?? 'Sin tipo'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})
  const tiposOrdenados = Object.entries(porTipo).sort((a, b) => b[1] - a[1])
  const maxTipo = tiposOrdenados.length > 0 ? tiposOrdenados[0][1] : 0

  return (
    <>
      <div className="mb-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          Ajustes de inventario
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Visión general de los ajustes de inventario.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card
          titulo="Ajustes pendientes"
          valor={pendientes.length}
          subtitulo={subtextoPendientes}
          tono={alertaPendientes ? 'alerta' : undefined}
        />
        <Card
          titulo="Realizados este mes"
          valor={realizadosMes.length}
          subtitulo="Fecha de cierre del mes en curso"
        />
        <Card
          titulo="Tiempo promedio de realización"
          valor={
            promedioDias === null ? '—' : `${promedioDias.toFixed(1)} días`
          }
          subtitulo={`${diasRealizacion.length} realizado${diasRealizacion.length === 1 ? '' : 's'} histórico${diasRealizacion.length === 1 ? '' : 's'}`}
        />
        <Card
          titulo="Monto neto del año"
          valor={formatCLP(montoNetoAno)}
          subtitulo="Alta suma, baja resta"
          tono={montoNetoAno < 0 ? 'negativo' : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Ajustes pendientes por tipo
          </h3>
          {tiposOrdenados.length === 0 ? (
            <div className="text-sm text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-2">
              {tiposOrdenados.map(([tipo, n]) => {
                const pct = maxTipo > 0 ? (n / maxTipo) * 100 : 0
                return (
                  <div key={tipo}>
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="text-gray-700">{tipo}</span>
                      <span className="text-gray-500">{n}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
