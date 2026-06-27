import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import EstadoBadge from '@/components/casos/EstadoBadge'
import TimelineEventos from '@/components/casos/TimelineEventos'
import AccionesCaso from '@/components/casos/AccionesCaso'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { gestionaCasosPropios } from '@/lib/auth'
import { formatFecha } from '@/lib/utils'
import type { Caso, Evento } from '@/types/caso'

interface Props {
  params: { id: string }
}

export default async function CasoDetallePage({ params }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const { data: caso } = await supabase
    .from('casos')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Caso>()

  if (!caso) notFound()

  if (gestionaCasosPropios(usuario.rol) && caso.responsable !== usuario.nombre) {
    return (
      <>
        <Header usuario={usuario} titulo="Caso" />
        <main className="flex-1 p-8">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
            No tienes acceso a este caso. Está asignado a otro gestor.
          </div>
        </main>
      </>
    )
  }

  const { data: eventos } = await supabase
    .from('eventos')
    .select('*')
    .eq('caso_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <>
      <Header usuario={usuario} titulo="Detalle del caso" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <Link
            href="/casos"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a casos
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              Caso #{caso.id.slice(0, 8)}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {caso.reportado_por ?? caso.colaborador_nombre ?? 'Sin nombre'}
            </h2>
            {caso.reportado_por &&
              caso.colaborador_nombre &&
              caso.colaborador_nombre !== caso.reportado_por && (
                <div className="text-sm text-gray-500 mt-1">
                  Afectado: {caso.colaborador_nombre}
                </div>
              )}
            <div className="text-sm text-gray-500 mt-1">
              {caso.local ?? '—'}
            </div>
          </div>
          <EstadoBadge estado={caso.estado} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Consulta
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {caso.consulta ?? 'Sin consulta registrada.'}
              </p>
            </section>

            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Información del colaborador
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500">Reportado por</dt>
                  <dd className="text-gray-900 font-medium">
                    {caso.reportado_por ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Colaborador afectado</dt>
                  <dd className="text-gray-900">
                    {caso.colaborador_nombre ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Número</dt>
                  <dd className="text-gray-900">
                    {caso.colaborador_numero ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Cargo</dt>
                  <dd className="text-gray-900">
                    {caso.colaborador_cargo ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Local</dt>
                  <dd className="text-gray-900">{caso.local ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Categoría</dt>
                  <dd className="text-gray-900">{caso.categoria ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Responsable</dt>
                  <dd className="text-gray-900">{caso.responsable ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha creación</dt>
                  <dd className="text-gray-900">
                    {formatFecha(caso.fecha_creacion ?? caso.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Fecha cierre</dt>
                  <dd className="text-gray-900">
                    {formatFecha(caso.fecha_cierre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">
                    Nivel de escalamiento
                  </dt>
                  <dd className="text-gray-900">
                    {caso.nivel_escalamiento ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Cerrado por</dt>
                  <dd className="text-gray-900">{caso.cerrado_por ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Timeline de eventos
              </h3>
              <TimelineEventos eventos={(eventos ?? []) as Evento[]} />
            </section>
          </div>

          {usuario.rol !== 'qf' && (
            <div className="col-span-1">
              <AccionesCaso casoId={caso.id} estadoActual={caso.estado} />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
