import InstruccionesCajaChicaForm from '@/components/configuracion/InstruccionesCajaChicaForm'
import FondosLocalesTabla from '@/components/configuracion/FondosLocalesTabla'
import { requireAdmin } from '@/lib/sesion'

export default async function CajaChicaConfigPage() {
  const usuario = await requireAdmin()
  if (!usuario.cliente_id) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
        Tu perfil no tiene cliente asignado.
      </div>
    )
  }
  return (
    <div className="space-y-8">
      <InstruccionesCajaChicaForm clienteId={usuario.cliente_id} />
      <FondosLocalesTabla clienteId={usuario.cliente_id} />
    </div>
  )
}
