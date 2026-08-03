import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import NuevaGestionForm from '@/components/gestion/NuevaGestionForm'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeCrearGestion } from '@/lib/gestion'

export default async function NuevaGestionPage() {
  const usuario = await getUsuarioActual()
  if (!puedeCrearGestion(usuario.rol)) redirect('/gestion')

  const supabase = createClient()
  const clienteId = usuario.cliente_id ?? ''

  const { data } = await supabase
    .from('locales')
    .select('codigo, nombre, empresa_id')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    // Excluye las cajas de oficina de Caja Chica (codigo 'OC...'): Gestion
    // es para farmacias con QF, no para cajas personales.
    .not('codigo', 'ilike', 'OC%')
    .order('orden', { ascending: true })

  const locales = data ?? []

  // Sin filtrar por si quedan con 0 locales: eso lo resuelve el formulario,
  // cruzando con la lista de locales ya cargada.
  const { data: empresasData } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('cliente_id', clienteId)

  const empresas = empresasData ?? []

  return (
    <>
      <Header usuario={usuario} titulo="Nueva gestión" />
      <main className="flex-1 p-8 overflow-y-auto">
        <NuevaGestionForm clienteId={clienteId} locales={locales} empresas={empresas} />
      </main>
    </>
  )
}
