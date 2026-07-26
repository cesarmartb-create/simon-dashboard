import Link from 'next/link'
import Header from '@/components/layout/Header'
import CasoTable from '@/components/casos/CasoTable'
import FiltrosCasos from '@/components/casos/FiltrosCasos'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import {
  gestionaCasosPropios,
  puedeVerVistaGlobal,
  puedeCrearCaso,
  nombreDesdeEmail,
} from '@/lib/auth'
import type { Caso } from '@/types/caso'

interface Props {
  searchParams: {
    estado?: string | string[]
    responsable?: string | string[]
    categoria?: string | string[]
    q?: string
  }
}

function comoArray(v?: string | string[]): string[] {
  return !v ? [] : Array.isArray(v) ? v : [v]
}

export default async function CasosPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const estadosSel = comoArray(searchParams.estado)
  const responsablesSel = comoArray(searchParams.responsable)
  const categoriasSel = comoArray(searchParams.categoria)

  let query = supabase
    .from('casos')
    .select('*')
    .order('fecha_creacion', { ascending: false })

  if (gestionaCasosPropios(usuario.rol)) {
    query = query.eq('responsable', usuario.nombre)
  } else if (responsablesSel.length > 0) {
    query = query.in('responsable', responsablesSel)
  }

  if (estadosSel.length > 0) {
    query = query.in('estado', estadosSel)
  }

  if (categoriasSel.length > 0) {
    query = query.in('categoria', categoriasSel)
  }

  if (searchParams.q) {
    const q = searchParams.q.trim()
    query = query.or(
      `colaborador_nombre.ilike.%${q}%,consulta.ilike.%${q}%,local.ilike.%${q}%`
    )
  }

  const { data: casos, error } = await query

  const { data: categoriaRows } = await supabase
    .from('casos')
    .select('categoria')
    .not('categoria', 'is', null)

  const categorias = Array.from(
    new Set((categoriaRows ?? []).map((r) => r.categoria as string))
  ).sort()

  const { data: responsableRows } = await supabase
    .from('casos')
    .select('responsable')
    .not('responsable', 'is', null)

  const responsables = Array.from(
    new Set((responsableRows ?? []).map((r) => r.responsable as string))
  )
    .map((correo) => ({ value: correo, label: nombreDesdeEmail(correo) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <>
      <Header usuario={usuario} titulo="Casos" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {puedeVerVistaGlobal(usuario.rol)
                ? 'Todos los casos'
                : 'Mis casos asignados'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {casos?.length ?? 0} caso{casos?.length === 1 ? '' : 's'}
            </p>
          </div>
          {puedeCrearCaso(usuario.rol) && (
            <Link
              href="/casos/nuevo"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Nueva solicitud
            </Link>
          )}
        </div>

        <FiltrosCasos
          rol={usuario.rol}
          categorias={categorias}
          responsables={responsables}
        />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando casos: {error.message}
          </div>
        ) : (
          <CasoTable
            casos={(casos ?? []) as Caso[]}
            mostrarResponsable={puedeVerVistaGlobal(usuario.rol)}
          />
        )}
      </main>
    </>
  )
}
