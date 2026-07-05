import Header from '@/components/layout/Header'
import KPICard from '@/components/metricas/KPICard'
import DistribucionEstados from '@/components/metricas/DistribucionEstados'
import SeccionAjustes from '@/components/metricas/SeccionAjustes'
import SeccionCajaChica from '@/components/metricas/SeccionCajaChica'
import { requireVistaGlobal } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS, type Caso, type EstadoCaso } from '@/types/caso'

export default async function MetricasPage() {
  const usuario = await requireVistaGlobal()
  const supabase = createClient()

  const { data: casosData } = await supabase.from('casos').select('*')
  const casos = (casosData ?? []) as Caso[]

  const total = casos.length
  const cerrados = casos.filter((c) => c.estado === 'cerrado')
  const escalados = casos.filter((c) => c.estado === 'escalado')
  const abiertos = casos.filter(
    (c) => c.estado !== 'cerrado'
  )

  const conteo = ESTADOS.reduce(
    (acc, e) => {
      acc[e] = casos.filter((c) => c.estado === e).length
      return acc
    },
    {} as Record<EstadoCaso, number>
  )

  const horasCierre = cerrados
    .filter((c) => c.fecha_creacion && c.fecha_cierre)
    .map((c) => {
      const inicio = new Date(c.fecha_creacion as string).getTime()
      const fin = new Date(c.fecha_cierre as string).getTime()
      return (fin - inicio) / (1000 * 60 * 60)
    })

  const promedio =
    horasCierre.length > 0
      ? horasCierre.reduce((a, b) => a + b, 0) / horasCierre.length
      : 0

  const promedioTexto =
    promedio === 0
      ? '—'
      : promedio < 24
        ? `${promedio.toFixed(1)} h`
        : `${(promedio / 24).toFixed(1)} d`

  const tasaCierre =
    total > 0 ? Math.round((cerrados.length / total) * 100) : 0

  return (
    <>
      <Header usuario={usuario} titulo="Métricas" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Resumen</h2>
          <p className="text-sm text-gray-500 mt-1">
            Visión general de todos los casos gestionados por Simón.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <KPICard titulo="Total de casos" valor={total} />
          <KPICard
            titulo="Casos abiertos"
            valor={abiertos.length}
            subtitulo="No cerrados"
            acento
          />
          <KPICard
            titulo="Tiempo promedio de cierre"
            valor={promedioTexto}
            subtitulo={`${cerrados.length} caso${cerrados.length === 1 ? '' : 's'} cerrado${cerrados.length === 1 ? '' : 's'}`}
          />
          <KPICard
            titulo="Tasa de cierre"
            valor={`${tasaCierre}%`}
            subtitulo={`${escalados.length} escalado${escalados.length === 1 ? '' : 's'}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <DistribucionEstados conteo={conteo} total={total} />

          <div className="bg-white border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Casos por categoría
            </h3>
            <CategoriaList casos={casos} />
          </div>
        </div>

        <SeccionAjustes usuario={usuario} />

        <SeccionCajaChica usuario={usuario} />
      </main>
    </>
  )
}

function CategoriaList({ casos }: { casos: Caso[] }) {
  const agrupados = casos.reduce<Record<string, number>>((acc, c) => {
    const cat = c.categoria ?? 'Sin categoría'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {})

  const ordenado = Object.entries(agrupados).sort((a, b) => b[1] - a[1])

  if (ordenado.length === 0) {
    return <div className="text-sm text-gray-500">Sin datos.</div>
  }

  const max = ordenado[0][1]

  return (
    <div className="space-y-2">
      {ordenado.map(([cat, n]) => {
        const pct = max > 0 ? (n / max) * 100 : 0
        return (
          <div key={cat}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-gray-700">{cat}</span>
              <span className="text-gray-500">{n}</span>
            </div>
            <div className="h-1.5 bg-gray-100 overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
