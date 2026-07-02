import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import NuevoAjusteForm from '@/components/ajustes/NuevoAjusteForm'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeCrearAjuste } from '@/lib/ajustes'

export default async function NuevoAjustePage() {
  const usuario = await getUsuarioActual()
  if (!puedeCrearAjuste(usuario)) redirect('/ajustes')

  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? 'grupobaco'

  const { data: tiposData } = await supabase
    .from('tipos_ajuste')
    .select('id, codigo, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('orden', { ascending: true })

  // Solo el admin elige local; el qf usa el suyo.
  let locales: string[] = []
  if (usuario.rol === 'admin') {
    const { data } = await supabase
      .from('locales')
      .select('codigo, nombre')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('orden', { ascending: true })
    locales = (data ?? []).map((l) => `${l.codigo} — ${l.nombre}`)
  }

  return (
    <>
      <Header usuario={usuario} titulo="Nuevo ajuste de inventario" />
      <main className="flex-1 p-8 overflow-y-auto">
        <NuevoAjusteForm
          esAdmin={usuario.rol === 'admin'}
          localFijo={usuario.rol === 'qf' ? (usuario.local ?? '') : null}
          locales={locales}
          tipos={(tiposData ?? []) as { id: string; codigo: string; nombre: string }[]}
        />
      </main>
    </>
  )
}
