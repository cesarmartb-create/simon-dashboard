import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import EstadoRendicionBadge from '@/components/cajachica/EstadoRendicionBadge'
import GastosSection from '@/components/cajachica/GastosSection'
import type { GastoConTipo } from '@/components/cajachica/GastosTabla'
import AccionesRendicion from '@/components/cajachica/AccionesRendicion'
import InstruccionesPanel from '@/components/cajachica/InstruccionesPanel'
import AdjuntosPanel from '@/components/adjuntos/AdjuntosPanel'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeVerCajaChica, puedeGestionarCajaChica } from '@/lib/cajachica'
import { nombreDesdeEmail } from '@/lib/auth'
import { formatFecha, formatCLP } from '@/lib/utils'
import { ADJUNTOS_BUCKET, type Adjunto, type AdjuntoConUrl } from '@/lib/adjuntos'
import type { RendicionCajaChica } from '@/types/cajachica'

interface Props {
  params: { id: string }
}

async function firmar(
  supabase: ReturnType<typeof createClient>,
  fila: Adjunto
): Promise<AdjuntoConUrl> {
  const { data: firma } = await supabase.storage
    .from(ADJUNTOS_BUCKET)
    .createSignedUrl(fila.ruta, 3600)
  return {
    ...fila,
    url: firma?.signedUrl ?? null,
    subido_por_nombre: fila.subido_por ? nombreDesdeEmail(fila.subido_por) : null,
  }
}

export default async function RendicionDetallePage({ params }: Props) {
  const usuario = await getUsuarioActual()

  const sinAcceso = (
    <>
      <Header usuario={usuario} titulo="Rendición de caja chica" />
      <main className="flex-1 p-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
          No tienes acceso a esta rendición.
        </div>
      </main>
    </>
  )

  if (!usuario.cliente_id || !puedeVerCajaChica(usuario)) return sinAcceso
  const clienteId = usuario.cliente_id
  const supabase = createClient()

  const { data: rendicion } = await supabase
    .from('rendiciones_caja_chica')
    .select('*')
    .eq('id', params.id)
    .eq('cliente_id', clienteId)
    .maybeSingle<RendicionCajaChica>()

  if (!rendicion) notFound()
  if (usuario.rol === 'qf' && rendicion.local !== (usuario.local ?? '')) {
    return sinAcceso
  }

  const gestiona = puedeGestionarCajaChica(usuario)
  // Dueno de unidad: admin o cualquier usuario cuyo local sea el de la rendicion.
  const esResponsable =
    usuario.rol === 'admin' ||
    (!!usuario.local && rendicion.local === usuario.local)
  const modoEdicion = rendicion.estado === 'abierto' && esResponsable
  const puedeEnviar = modoEdicion
  const modoRevision = gestiona && rendicion.estado === 'en_revision'
  // Comprobante: visible para todo el que ve la rendicion (incluido el qf, es su
  // prueba de reposicion); la SUBIDA/eliminacion queda solo para quien gestiona.
  const mostrarComprobante = ['aprobada', 'aprobada_parcial', 'pagado'].includes(
    rendicion.estado
  )

  const { data: gastosData } = await supabase
    .from('gastos_caja_chica')
    .select('*, tipos_gasto(nombre)')
    .eq('rendicion_id', rendicion.id)
    .eq('cliente_id', clienteId)
    .order('fecha_gasto', { ascending: true })
    .order('created_at', { ascending: true })
  const gastos = (gastosData ?? []) as GastoConTipo[]
  const gastoIds = gastos.map((g) => g.id)

  // Boletas por gasto.
  const adjuntosPorGasto: Record<string, AdjuntoConUrl[]> = {}
  if (gastoIds.length > 0) {
    const { data: boletasData } = await supabase
      .from('adjuntos')
      .select('*')
      .in('gasto_id', gastoIds)
      .order('created_at', { ascending: true })
    for (const fila of (boletasData ?? []) as Adjunto[]) {
      const conUrl = await firmar(supabase, fila)
      const gid = fila.gasto_id as string
      ;(adjuntosPorGasto[gid] ??= []).push(conUrl)
    }
  }

  // Comprobantes de la rendicion (para gestores que pagan).
  let comprobantes: AdjuntoConUrl[] = []
  if (mostrarComprobante) {
    const { data: compData } = await supabase
      .from('adjuntos')
      .select('*')
      .eq('rendicion_id', rendicion.id)
      .order('created_at', { ascending: true })
    comprobantes = await Promise.all(
      ((compData ?? []) as Adjunto[]).map((f) => firmar(supabase, f))
    )
  }

  // Tipos de gasto para el formulario.
  const { data: tiposData } = await supabase
    .from('tipos_gasto')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('orden', { ascending: true })
  const tipos = (tiposData ?? []) as { id: string; nombre: string }[]

  const { data: config } = await supabase
    .from('configuracion_cliente')
    .select('instrucciones_caja_chica')
    .eq('cliente_id', clienteId)
    .maybeSingle<{ instrucciones_caja_chica: string | null }>()

  // Advertencia blanda al enviar: gastos sin adjunto de boleta.
  const gastosSinBoleta = gastos.filter(
    (g) => !(adjuntosPorGasto[g.id]?.length)
  ).length

  return (
    <>
      <Header usuario={usuario} titulo="Detalle de rendición" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <Link
            href="/caja-chica"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a caja chica
          </Link>
        </div>

        <InstruccionesPanel texto={config?.instrucciones_caja_chica ?? null} />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              Rendición #{rendicion.numero} · {rendicion.periodo}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {rendicion.local}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {rendicion.excede_fondo && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300">
                Excede fondo
              </span>
            )}
            <EstadoRendicionBadge estado={rendicion.estado} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Información de la rendición
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Local</dt>
                  <dd className="text-gray-900">{rendicion.local}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Reportado por</dt>
                  <dd className="text-gray-900">{rendicion.reportado_por}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Periodo</dt>
                  <dd className="text-gray-900">{rendicion.periodo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Total</dt>
                  <dd className="text-gray-900">{formatCLP(rendicion.total)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fondo (al enviar)</dt>
                  <dd className="text-gray-900">
                    {rendicion.monto_fondo_snapshot != null
                      ? formatCLP(rendicion.monto_fondo_snapshot)
                      : 'Sin fondo'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha de envío</dt>
                  <dd className="text-gray-900">
                    {formatFecha(rendicion.fecha_envio)}
                  </dd>
                </div>
              </dl>
            </section>

            <GastosSection
              rendicionId={rendicion.id}
              clienteId={rendicion.cliente_id}
              gastos={gastos}
              adjuntosPorGasto={adjuntosPorGasto}
              tipos={tipos}
              modoRevision={modoRevision}
              modoEdicion={modoEdicion}
            />

            {rendicion.estado !== 'abierto' &&
              rendicion.estado !== 'en_revision' && (
                <section className="bg-white border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Cierre
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Aprobado por</dt>
                      <dd className="text-gray-900">
                        {rendicion.aprobado_por ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Fecha aprobación</dt>
                      <dd className="text-gray-900">
                        {formatFecha(rendicion.fecha_aprobacion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Pagado por</dt>
                      <dd className="text-gray-900">
                        {rendicion.pagado_por ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Fecha de pago</dt>
                      <dd className="text-gray-900">
                        {formatFecha(rendicion.fecha_pago)}
                      </dd>
                    </div>
                    {rendicion.observacion_cierre && (
                      <div className="col-span-2">
                        <dt className="text-xs text-gray-500">
                          Observación de cierre
                        </dt>
                        <dd className="text-gray-900 whitespace-pre-wrap">
                          {rendicion.observacion_cierre}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}

            {mostrarComprobante && (
              <AdjuntosPanel
                entidad="rendiciones"
                entidadId={rendicion.id}
                clienteId={rendicion.cliente_id}
                adjuntos={comprobantes}
                esAdmin={usuario.rol === 'admin'}
                soloLectura={!gestiona}
                titulo="Comprobante de transferencia"
              />
            )}
          </div>

          <div className="col-span-1">
            <AccionesRendicion
              rendicionId={rendicion.id}
              estado={rendicion.estado}
              puedeEnviar={puedeEnviar}
              gestiona={gestiona}
              gastosSinBoleta={gastosSinBoleta}
            />
          </div>
        </div>
      </main>
    </>
  )
}
