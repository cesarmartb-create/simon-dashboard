import Link from 'next/link'
import Header from '@/components/layout/Header'
import GestionTabla from '@/components/gestion/GestionTabla'
import FiltrosGestion from '@/components/gestion/FiltrosGestion'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeCrearGestion } from '@/lib/gestion'
import { comoArray } from '@/lib/utils'
import type { Gestion } from '@/types/gestion'

interface Props {
  searchParams: {
    tipo?: string | string[]
    estado?: string | string[]
    local?: string | string[]
  }
}

export default async function GestionPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const tiposSel = comoArray(searchParams.tipo)
  const estadosSel = comoArray(searchParams.estado)
  const localesSel = comoArray(searchParams.local)

  let query = supabase
    .from('gestion')
    .select('*')
    .order('created_at', { ascending: false })

  if (usuario.rol === 'qf') {
    query = query.eq('local', usuario.local ?? '')
  }
  if (tiposSel.length > 0) query = query.in('tipo', tiposSel)
  if (estadosSel.length > 0) {
    query = query.in('estado', estadosSel)
  } else {
    query = query.neq('estado', 'anulada')
  }
  if (localesSel.length > 0) query = query.in('local', localesSel)

  const { data: filas, error } = await query

  const { data: localesRows } = await supabase
    .from('gestion')
    .select('local')
    .not('local', 'is', null)

  const locales = Array.from(
    new Set((localesRows ?? []).map((r) => r.local as string))
  ).sort()

  const gruposIds = Array.from(
    new Set(
      (filas ?? [])
        .map((f) => f.grupo_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const totalesPorGrupo: Record<string, { total: number; completadas: number }> = {}

  if (gruposIds.length > 0) {
    const { data: filasGrupos } = await supabase
      .from('gestion')
      .select('grupo_id, estado')
      .in('grupo_id', gruposIds)
      .neq('estado', 'anulada')

    for (const f of filasGrupos ?? []) {
      const grupoId = f.grupo_id as string
      if (!totalesPorGrupo[grupoId]) {
        totalesPorGrupo[grupoId] = { total: 0, completadas: 0 }
      }
      totalesPorGrupo[grupoId].total += 1
      if (f.estado === 'leida' || f.estado === 'respondida') {
        totalesPorGrupo[grupoId].completadas += 1
      }
    }
  }

  return (
    <>
      <Header usuario={usuario} titulo="Gestión" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gestión</h2>
            <p className="text-sm text-gray-500 mt-1">
              {filas?.length ?? 0} gestión{filas?.length === 1 ? '' : 'es'}
            </p>
          </div>
          {puedeCrearGestion(usuario.rol) && (
            <Link
              href="/gestion/nueva"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Nueva
            </Link>
          )}
        </div>

        <FiltrosGestion locales={locales} />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando gestión: {error.message}
          </div>
        ) : (
          <GestionTabla
            filas={(filas ?? []) as Gestion[]}
            usuario={usuario}
            totalesPorGrupo={totalesPorGrupo}
          />
        )}
      </main>
    </>
  )
}
