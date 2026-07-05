import { createClient } from '@/lib/supabase/server'
import { puedeVerCajaChica } from '@/lib/cajachica'
import { formatCLP } from '@/lib/utils'
import {
  ESTADO_RENDICION_LABEL,
  type EstadoRendicion,
} from '@/types/cajachica'
import type { Usuario } from '@/types/usuario'

interface FilaRendicion {
  estado: EstadoRendicion
  total: number | null
  periodo: string
  excede_fondo: boolean
  local: string
}

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
      {subtitulo && <div className="mt-1 text-xs text-gray-500">{subtitulo}</div>}
    </div>
  )
}

export default async function SeccionCajaChica({
  usuario,
}: {
  usuario: Usuario
}) {
  // Mismo gate que el listado; si no puede ver caja chica, no aparece.
  // Fallo cerrado sin fallback de cliente (regla del modulo).
  if (!puedeVerCajaChica(usuario) || !usuario.cliente_id) return null
  const clienteId = usuario.cliente_id

  const supabase = createClient()
  let query = supabase
    .from('rendiciones_caja_chica')
    .select('estado, total, periodo, excede_fondo, local')
    .eq('cliente_id', clienteId)

  if (usuario.rol === 'qf') {
    query = query.eq('local', usuario.local ?? '')
  }

  const { data } = await query
  const rendiciones = (data ?? []) as FilaRendicion[]

  const ahora = new Date()
  const periodoActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`

  const delPeriodo = rendiciones.filter((r) => r.periodo === periodoActual)
  const totalPeriodo = delPeriodo.reduce((s, r) => s + Number(r.total ?? 0), 0)

  const porRevisar = rendiciones.filter((r) => r.estado === 'en_revision').length
  const porPagar = rendiciones.filter(
    (r) => r.estado === 'aprobada' || r.estado === 'aprobada_parcial'
  ).length
  const excesos = rendiciones.filter(
    (r) => r.excede_fondo && r.estado !== 'rechazada'
  ).length

  // Distribucion por estado.
  const porEstado = rendiciones.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] ?? 0) + 1
    return acc
  }, {})
  const estadosOrdenados = Object.entries(porEstado).sort((a, b) => b[1] - a[1])
  const maxEstado = estadosOrdenados.length > 0 ? estadosOrdenados[0][1] : 0

  return (
    <>
      <div className="mb-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Caja chica</h2>
        <p className="text-sm text-gray-500 mt-1">
          Visión general de las rendiciones de caja chica.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card
          titulo="Total del periodo"
          valor={formatCLP(totalPeriodo)}
          subtitulo={`${periodoActual} · ${delPeriodo.length} rendici${delPeriodo.length === 1 ? 'ón' : 'ones'}`}
        />
        <Card
          titulo="Por revisar"
          valor={porRevisar}
          subtitulo="En revisión"
        />
        <Card
          titulo="Por pagar"
          valor={porPagar}
          subtitulo="Aprobadas sin pagar"
        />
        <Card
          titulo="Alertas de exceso"
          valor={excesos}
          subtitulo="Rendiciones que exceden el fondo"
          tono={excesos > 0 ? 'alerta' : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Rendiciones por estado
          </h3>
          {estadosOrdenados.length === 0 ? (
            <div className="text-sm text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-2">
              {estadosOrdenados.map(([estado, n]) => {
                const pct = maxEstado > 0 ? (n / maxEstado) * 100 : 0
                return (
                  <div key={estado}>
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="text-gray-700">
                        {ESTADO_RENDICION_LABEL[estado as EstadoRendicion] ?? estado}
                      </span>
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
