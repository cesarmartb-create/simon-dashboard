import CatalogoTabla from '@/components/configuracion/CatalogoTabla'
import { requireAdmin } from '@/lib/sesion'

export default async function EmpresasPage() {
  const usuario = await requireAdmin()
  if (!usuario.cliente_id) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm max-w-xl">
        Tu perfil no tiene cliente asignado.
      </div>
    )
  }
  return (
    <CatalogoTabla
      clienteId={usuario.cliente_id}
      tabla="empresas"
      titulo="Empresas"
      etiquetaSingular="empresa"
      codigoPlaceholder="ej. cokoa"
      nombrePlaceholder="ej. Sociedad Cokoa SpA"
    />
  )
}
