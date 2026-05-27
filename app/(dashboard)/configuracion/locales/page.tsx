import LocalesTabla from '@/components/configuracion/LocalesTabla'
import { requireAdmin } from '@/lib/sesion'

export default async function LocalesPage() {
  await requireAdmin()
  return <LocalesTabla />
}
