import Link from 'next/link'
import Header from '@/components/layout/Header'
import RendicionesTabla from '@/components/cajachica/RendicionesTabla'
import FiltrosRendiciones from '@/components/cajachica/FiltrosRendiciones'
import InstruccionesPanel from '@/components/cajachica/InstruccionesPanel'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import {
  puedeVerCajaChica,
  puedeCrearRendicion,
  saldoDisponible,
} from '@/lib/cajachica'
import { formatCLP } from '@/lib/utils'
import type { RendicionCajaChica } from '@/types/cajachica'

interface Props {
  searchParams: {
    estado?: string
    periodo?: string
    local?: string
  }
}

export default async function CajaChicaPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual()

  const sinCliente = !usuario.cliente_id
  if (sinCliente || !puedeVerCajaChica(usuario)) {
    return (
      <>
        <Header usuario={usuario} titulo="Caja chica" />
        <main className="flex-1 p-8">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
            {sinCliente
              ? 'Tu perfil no tiene cliente asignado.'
              : 'No tienes acceso a caja chica.'}
          </div>
        </main>
      </>
    )
  }

  const supabase = createClient()
  const clienteId = usuario.cliente_id as string

  const { data: config } = await supabase
    .from('configuracion_cliente')
    .select('instrucciones_caja_chica')
    .eq('cliente_id', clienteId)
    .maybeSingle<{ instrucciones_caja_chica: string | null }>()

  let query = supabase
    .from('rendiciones_caja_chica')
    .select('*')
    .eq('cliente_id', clienteId)

  if (usuario.rol === 'qf') {
    query = query.eq('local', usuario.local ?? '')
  } else if (searchParams.local) {
    query = query.eq('local', searchParams.local)
  }
  if (searchParams.estado) query = query.eq('estado', searchParams.estado)
  if (searchParams.periodo) query = query.eq('periodo', searchParams.periodo)

  const { data: rows, error } = await query.order('created_at', {
    ascending: false,
  })
  const rendiciones = (rows ?? []) as RendicionCajaChica[]

  // Locales para el filtro (cualquier rol que ve mas de un local), de los datos.
  const puedeFiltrarLocal = usuario.rol !== 'qf'
  let locales: string[] = []
  if (puedeFiltrarLocal) {
    const { data: localRows } = await supabase
      .from('rendiciones_caja_chica')
      .select('local')
      .eq('cliente_id', clienteId)
    locales = Array.from(
      new Set((localRows ?? []).map((r) => r.local as string))
    ).sort()
  }

  // Saldo del qf si su unidad tiene fondo.
  let saldoBanner: { monto: number; saldo: number } | null = null
  if (usuario.rol === 'qf' && usuario.local) {
    const { data: fondo } = await supabase
      .from('fondos_caja_chica')
      .select('monto_asignado')
      .eq('cliente_id', clienteId)
      .eq('local', usuario.local)
      .eq('activo', true)
      .maybeSingle<{ monto_asignado: number }>()
    if (fondo) {
      const { data: aprobadasNoPagadas } = await supabase
        .from('rendiciones_caja_chica')
        .select('total')
        .eq('cliente_id', clienteId)
        .eq('local', usuario.local)
        .in('estado', ['aprobada', 'aprobada_parcial'])
        .is('fecha_pago', null)
      const usado = (aprobadasNoPagadas ?? []).reduce(
        (s, r) => s + Number((r as { total: number }).total ?? 0),
        0
      )
      saldoBanner = {
        monto: fondo.monto_asignado,
        saldo: saldoDisponible(fondo.monto_asignado, usado),
      }
    }
  }

  return (
    <>
      <Header usuario={usuario} titulo="Caja chica" />
      <main className="flex-1 p-8 overflow-y-auto">
        <InstruccionesPanel texto={config?.instrucciones_caja_chica ?? null} />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {usuario.rol === 'qf' ? 'Rendiciones de mi local' : 'Todas las rendiciones'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {rendiciones.length} rendici{rendiciones.length === 1 ? 'ón' : 'ones'}
            </p>
          </div>
          {puedeCrearRendicion(usuario) && (
            <Link
              href="/caja-chica/nueva"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Nueva rendición
            </Link>
          )}
        </div>

        {saldoBanner && (
          <div className="mb-6 bg-white border border-gray-200 p-4 text-sm flex gap-8">
            <div>
              <div className="text-xs text-gray-500">Fondo asignado</div>
              <div className="text-gray-900 font-medium">
                {formatCLP(saldoBanner.monto)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Saldo disponible</div>
              <div
                className={
                  saldoBanner.saldo < 0
                    ? 'text-red-700 font-semibold'
                    : 'text-gray-900 font-medium'
                }
              >
                {formatCLP(saldoBanner.saldo)}
              </div>
            </div>
          </div>
        )}

        <FiltrosRendiciones puedeFiltrarLocal={puedeFiltrarLocal} locales={locales} />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            Error cargando rendiciones.
          </div>
        ) : (
          <RendicionesTabla rendiciones={rendiciones} />
        )}
      </main>
    </>
  )
}
