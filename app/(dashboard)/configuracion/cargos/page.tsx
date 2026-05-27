import CargosTabla from '@/components/configuracion/CargosTabla'
import { requireAdmin } from '@/lib/sesion'

export default async function CargosPage() {
  await requireAdmin()
  return <CargosTabla />
}
