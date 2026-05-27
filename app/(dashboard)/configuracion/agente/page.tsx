import AgenteForm from '@/components/configuracion/AgenteForm'
import { requireAdmin } from '@/lib/sesion'

export default async function AgentePage() {
  await requireAdmin()
  return <AgenteForm />
}
