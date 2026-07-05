import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import NuevaRendicionForm from '@/components/cajachica/NuevaRendicionForm'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeCrearRendicion } from '@/lib/cajachica'

export default async function NuevaRendicionPage() {
  const usuario = await getUsuarioActual()
  if (!puedeCrearRendicion(usuario)) redirect('/caja-chica')

  if (!usuario.cliente_id) {
    return (
      <>
        <Header usuario={usuario} titulo="Nueva rendición" />
        <main className="flex-1 p-8">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
            Tu perfil no tiene cliente asignado.
          </div>
        </main>
      </>
    )
  }

  const supabase = createClient()

  // Solo el admin elige local; el qf usa el suyo.
  let locales: string[] = []
  if (usuario.rol === 'admin') {
    const { data } = await supabase
      .from('locales')
      .select('codigo, nombre')
      .eq('cliente_id', usuario.cliente_id)
      .eq('activo', true)
      .order('orden', { ascending: true })
    locales = (data ?? []).map((l) => `${l.codigo} — ${l.nombre}`)
  }

  const periodoDefault = new Date().toISOString().slice(0, 7)

  return (
    <>
      <Header usuario={usuario} titulo="Nueva rendición de caja chica" />
      <main className="flex-1 p-8 overflow-y-auto">
        <NuevaRendicionForm
          esAdmin={usuario.rol === 'admin'}
          localFijo={usuario.rol === 'qf' ? (usuario.local ?? '') : null}
          locales={locales}
          periodoDefault={periodoDefault}
        />
      </main>
    </>
  )
}
