import { redirect } from 'next/navigation'
import { getUsuarioActual } from '@/lib/sesion'
import { rutaInicio } from '@/lib/navegacion'

export default async function HomePage() {
  const usuario = await getUsuarioActual()
  redirect(rutaInicio(usuario))
}
