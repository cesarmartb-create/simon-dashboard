import Link from 'next/link'
import Header from '@/components/layout/Header'
import AjustesTabla, {
  type AjusteConTipo,
} from '@/components/ajustes/AjustesTabla'
import FiltrosAjustes from '@/components/ajustes/FiltrosAjustes'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import {
  puedeVerAjustes,
  puedeGestionarAjustes,
  puedeCrearAjuste,
} from '@/lib/ajustes'

interface Props {
  searchParams: {
    estado?: string
    tipo?: string
    local?: string
  }
}

export default async function AjustesPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()
  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? 'grupobaco'

  // Gestor sin el área 'ajustes_inventario' no ve ajustes.
  if (!puedeVerAjustes(usuario)) {
    return (
      <>
        <Header usuario={usuario} titulo="Ajustes de inventario" />
        <main className="flex-1 p-8">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
            No tienes acceso a los ajustes de inventario.
          </div>
        </main>
      </>
    )
  }

  // Las policies de ajustes_inventario son permisivas: el filtrado
  // por rol se hace aquí, igual que en casos.
  let query = supabase
    .from('ajustes_inventario')
    .select('*, tipos_ajuste(nombre)')
    .eq('cliente_id', clienteId)

  if (usuario.rol === 'qf') {
    query = query.eq('local', usuario.local ?? '')
  } else if (searchParams.local) {
    query = query.eq('local', searchParams.local)
  }

  if (searchParams.estado) {
    query = query.eq('estado', searchParams.estado)
  }
  if (searchParams.tipo) {
    query = query.eq('tipo_id', searchParams.tipo)
  }

  const { data: rows, error } = await query

  // Orden default: pendientes primero, más antiguos arriba.
  const ajustes = ((rows ?? []) as AjusteConTipo[]).sort((a, b) => {
    const pa = a.estado === 'pendiente' ? 0 : 1
    const pb = b.estado === 'pendiente' ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const { data: tiposData } = await supabase
    .from('tipos_ajuste')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('orden', { ascending: true })

  const tipos = (tiposData ?? []) as { id: string; nombre: string }[]

  // Locales para el filtro (solo admin / gestor con área), derivados de los datos.
  const gestiona = puedeGestionarAjustes(usuario)
  let locales: string[] = []
  if (gestiona) {
    const { data: localRows } = await supabase
      .from('ajustes_inventario')
      .select('local')
      .eq('cliente_id', clienteId)
    locales = Array.from(
      new Set((localRows ?? []).map((r) => r.local as string))
    ).sort()
  }

  return (
    <>
      <Header usuario={usuario} titulo="Ajustes de inventario" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {usuario.rol === 'qf'
                ? 'Ajustes de mi local'
                : 'Todos los ajustes'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {ajustes.length} ajuste{ajustes.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {usuario.rol === 'admin' && (
              <Link
                href="/ajustes/resumen"
                className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Resumen
              </Link>
            )}
            {puedeCrearAjuste(usuario) && (
              <Link
                href="/ajustes/nuevo"
                className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                Nuevo ajuste
              </Link>
            )}
          </div>
        </div>

        <FiltrosAjustes
          puedeFiltrarLocal={gestiona}
          tipos={tipos}
          locales={locales}
        />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando ajustes: {error.message}
          </div>
        ) : (
          <AjustesTabla ajustes={ajustes} />
        )}
      </main>
    </>
  )
}
