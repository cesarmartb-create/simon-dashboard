import Header from '@/components/layout/Header'
import CasoTable from '@/components/casos/CasoTable'
import FiltrosCasos from '@/components/casos/FiltrosCasos'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Caso } from '@/types/caso'

interface Props {
  searchParams: {
    estado?: string
    responsable?: string
    categoria?: string
    q?: string
  }
}

export default async function CasosPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  let query = supabase
    .from('casos')
    .select('*')
    .order('fecha_creacion', { ascending: false })

  if (usuario.rol === 'gestor') {
    query = query.eq('responsable', usuario.nombre)
  } else if (searchParams.responsable) {
    query = query.eq('responsable', searchParams.responsable)
  }

  if (searchParams.estado) {
    query = query.eq('estado', searchParams.estado)
  }

  if (searchParams.categoria) {
    query = query.eq('categoria', searchParams.categoria)
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

  return (
    <>
      <Header usuario={usuario} titulo="Casos" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {usuario.rol === 'supervisor'
                ? 'Todos los casos'
                : 'Mis casos asignados'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {casos?.length ?? 0} caso{casos?.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <FiltrosCasos rol={usuario.rol} categorias={categorias} />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando casos: {error.message}
          </div>
        ) : (
          <CasoTable
            casos={(casos ?? []) as Caso[]}
            mostrarResponsable={usuario.rol === 'supervisor'}
          />
        )}
      </main>
    </>
  )
}
