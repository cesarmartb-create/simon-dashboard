import DerivacionesTabla from '@/components/configuracion/DerivacionesTabla'
import { requireAdmin } from '@/lib/sesion'

export default async function DerivacionesPage() {
  await requireAdmin()
  return <DerivacionesTabla />
}
