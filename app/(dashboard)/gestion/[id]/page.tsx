import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import TimelineEventos from '@/components/casos/TimelineEventos'
import AdjuntosPanel from '@/components/adjuntos/AdjuntosPanel'
import ResponderGestion from '@/components/gestion/ResponderGestion'
import AgregarComentario from '@/components/gestion/AgregarComentario'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { nombreDesdeEmail } from '@/lib/auth'
import { puedeResponderGestion } from '@/lib/gestion'
import { formatFecha } from '@/lib/utils'
import { ADJUNTOS_BUCKET, type Adjunto, type AdjuntoConUrl } from '@/lib/adjuntos'
import { TIPO_GESTION_LABEL, ESTADO_GESTION_LABEL, esVencida } from '@/types/gestion'
import type { Gestion } from '@/types/gestion'
import type { EventoTimeline } from '@/types/caso'

interface Props {
  params: { id: string }
}

export default async function GestionDetallePage({ params }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const { data: fila } = await supabase
    .from('gestion')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Gestion>()

  if (!fila) notFound()

  const { data: eventos } = await supabase
    .from('eventos')
    .select('*')
    .eq('gestion_id', params.id)
    .order('created_at', { ascending: true })

  const { data: adjuntosData } = await supabase
    .from('adjuntos')
    .select('*')
    .eq('gestion_id', params.id)
    .order('created_at', { ascending: true })

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

  const vencida = esVencida(fila)

  return (
    <>
      <Header usuario={usuario} titulo="Detalle de gestión" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <Link
            href="/gestion"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a gestión
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {TIPO_GESTION_LABEL[fila.tipo]}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{fila.titulo}</h2>
            <div className="text-sm text-gray-500 mt-1">{fila.local}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {ESTADO_GESTION_LABEL[fila.estado]}
            </span>
            {vencida && (
              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
                Vencida
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Instrucciones
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {fila.instrucciones ?? 'Sin instrucciones registradas.'}
              </p>
            </section>

            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Información
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Creado por</dt>
                  <dd className="text-gray-900">{nombreDesdeEmail(fila.creado_por)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha creación</dt>
                  <dd className="text-gray-900">{formatFecha(fila.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha límite</dt>
                  <dd className="text-gray-900">{fila.fecha_limite ?? '—'}</dd>
                </div>
                {fila.tipo === 'comunicado' && (
                  <div>
                    <dt className="text-xs text-gray-500">Folio externo</dt>
                    <dd className="text-gray-900">{fila.folio_externo ?? '—'}</dd>
                  </div>
                )}
                {fila.respondido_por && (
                  <>
                    <div>
                      <dt className="text-xs text-gray-500">
                        {fila.tipo === 'solicitud' ? 'Respondido por' : 'Leído por'}
                      </dt>
                      <dd className="text-gray-900">
                        {nombreDesdeEmail(fila.respondido_por)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Fecha respuesta</dt>
                      <dd className="text-gray-900">
                        {formatFecha(fila.fecha_respuesta)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </section>

            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Timeline de eventos
              </h3>
              <TimelineEventos eventos={(eventos ?? []) as EventoTimeline[]} />
            </section>

            <AgregarComentario gestionId={fila.id} />

            {fila.tipo === 'solicitud' &&
              fila.estado === 'pendiente' &&
              puedeResponderGestion(usuario, fila) && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
                  Aquí está el documento de la solicitud (el que debes firmar). Para
                  enviar tu respuesta ya firmada, usa el botón &apos;Responder&apos;
                  que está arriba, en Acciones — no basta con adjuntarla aquí abajo.
                </div>
              )}

            <AdjuntosPanel
              entidad="gestion"
              entidadId={fila.id}
              clienteId={fila.cliente_id}
              adjuntos={adjuntos}
              esAdmin={usuario.rol === 'admin'}
            />
          </div>

          <div className="col-span-1 space-y-6">
            <ResponderGestion fila={fila} usuario={usuario} />
          </div>
        </div>
      </main>
    </>
  )
}
