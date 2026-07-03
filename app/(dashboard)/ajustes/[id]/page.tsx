import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import EstadoAjusteBadge from '@/components/ajustes/EstadoAjusteBadge'
import AccionesAjuste from '@/components/ajustes/AccionesAjuste'
import AdjuntosPanel from '@/components/adjuntos/AdjuntosPanel'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeVerAjustes, puedeGestionarAjustes } from '@/lib/ajustes'
import { nombreDesdeEmail } from '@/lib/auth'
import { formatFecha, formatCLP } from '@/lib/utils'
import { ADJUNTOS_BUCKET, type Adjunto, type AdjuntoConUrl } from '@/lib/adjuntos'
import { DIRECCION_AJUSTE_LABEL } from '@/types/ajuste'
import type { AjusteConTipo } from '@/components/ajustes/AjustesTabla'

interface Props {
  params: { id: string }
}

export default async function AjusteDetallePage({ params }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? 'grupobaco'

  const sinAcceso = (
    <>
      <Header usuario={usuario} titulo="Ajuste de inventario" />
      <main className="flex-1 p-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
          No tienes acceso a este ajuste.
        </div>
      </main>
    </>
  )

  if (!puedeVerAjustes(usuario)) return sinAcceso

  const { data: ajuste } = await supabase
    .from('ajustes_inventario')
    .select('*, tipos_ajuste(nombre)')
    .eq('id', params.id)
    .eq('cliente_id', clienteId)
    .maybeSingle<AjusteConTipo>()

  if (!ajuste) notFound()

  // qf: solo ajustes de su propio local (las policies son permisivas).
  if (usuario.rol === 'qf' && ajuste.local !== (usuario.local ?? '')) {
    return sinAcceso
  }

  const gestiona = puedeGestionarAjustes(usuario)

  const { data: adjuntosData } = await supabase
    .from('adjuntos')
    .select('*')
    .eq('ajuste_id', params.id)
    .order('created_at', { ascending: true })

  // URLs firmadas server-side (1 hora) para ver/descargar los archivos privados.
  const adjuntos: AdjuntoConUrl[] = await Promise.all(
    ((adjuntosData ?? []) as Adjunto[]).map(async (a) => {
      const { data: firma } = await supabase.storage
        .from(ADJUNTOS_BUCKET)
        .createSignedUrl(a.ruta, 3600)
      return {
        ...a,
        url: firma?.signedUrl ?? null,
        subido_por_nombre: a.subido_por ? nombreDesdeEmail(a.subido_por) : null,
      }
    })
  )

  return (
    <>
      <Header usuario={usuario} titulo="Detalle del ajuste" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <Link
            href="/ajustes"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a ajustes
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              Ajuste #{ajuste.id.slice(0, 8)}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {ajuste.tipos_ajuste?.nombre ?? 'Ajuste'} ·{' '}
              {DIRECCION_AJUSTE_LABEL[ajuste.direccion] ?? ajuste.direccion}
            </h2>
            <div className="text-sm text-gray-500 mt-1">{ajuste.local}</div>
          </div>
          <EstadoAjusteBadge estado={ajuste.estado} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Información del ajuste
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Local</dt>
                  <dd className="text-gray-900">{ajuste.local}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Reportado por</dt>
                  <dd className="text-gray-900">{ajuste.reportado_por}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Tipo</dt>
                  <dd className="text-gray-900">
                    {ajuste.tipos_ajuste?.nombre ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Dirección</dt>
                  <dd className="text-gray-900">
                    {DIRECCION_AJUSTE_LABEL[ajuste.direccion] ??
                      ajuste.direccion}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Cantidad de SKU</dt>
                  <dd className="text-gray-900">{ajuste.cantidad_sku}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Monto</dt>
                  <dd className="text-gray-900">{formatCLP(ajuste.monto)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Folio de origen</dt>
                  <dd className="text-gray-900">
                    {ajuste.folio_origen ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Folio de referencia</dt>
                  <dd className="text-gray-900">
                    {ajuste.folio_referencia ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha creación</dt>
                  <dd className="text-gray-900">
                    {formatFecha(ajuste.created_at)}
                  </dd>
                </div>
              </dl>
            </section>

            {ajuste.observacion && (
              <section className="bg-white border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Observación
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {ajuste.observacion}
                </p>
              </section>
            )}

            {ajuste.estado !== 'pendiente' && (
              <section className="bg-white border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Cierre
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Folio del ajuste</dt>
                    <dd className="text-gray-900">
                      {ajuste.folio_ajuste ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Cerrado por</dt>
                    <dd className="text-gray-900">
                      {ajuste.cerrado_por ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Fecha cierre</dt>
                    <dd className="text-gray-900">
                      {formatFecha(ajuste.fecha_cierre)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">
                      Observación de cierre
                    </dt>
                    <dd className="text-gray-900">
                      {ajuste.observacion_cierre ?? '—'}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            <AdjuntosPanel
              entidad="ajustes"
              entidadId={ajuste.id}
              clienteId={ajuste.cliente_id}
              adjuntos={adjuntos}
              esAdmin={usuario.rol === 'admin'}
            />
          </div>

          {gestiona && ajuste.estado === 'pendiente' && (
            <div className="col-span-1">
              <AccionesAjuste
                ajusteId={ajuste.id}
                montoActual={ajuste.monto}
              />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
