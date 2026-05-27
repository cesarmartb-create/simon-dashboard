import DerivacionesForm from '@/components/configuracion/DerivacionesForm'
import { requireAdmin } from '@/lib/sesion'

export default async function DerivacionesPage() {
  await requireAdmin()
  return <DerivacionesForm />
}
