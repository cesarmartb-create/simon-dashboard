import NuevaSolicitudForm from '@/components/casos/NuevaSolicitudForm'
import Header from '@/components/layout/Header'
import { requireCrearCaso } from '@/lib/sesion'

export default async function NuevaSolicitudPage() {
  const usuario = await requireCrearCaso()

  return (
    <>
      <Header usuario={usuario} titulo="Nueva solicitud" />
      <main className="flex-1 p-8 overflow-y-auto">
        <NuevaSolicitudForm
          clienteId={usuario.cliente_id ?? ''}
          local={usuario.local ?? ''}
        />
      </main>
    </>
  )
}
