import ColaboradoresTabla from '@/components/configuracion/ColaboradoresTabla'
import { requireConfiguracion } from '@/lib/sesion'

export default async function ColaboradoresPage() {
  // Accesible para admin y operador (el layout ya valida el acceso a Configuración).
  await requireConfiguracion()

  return <ColaboradoresTabla />
}
