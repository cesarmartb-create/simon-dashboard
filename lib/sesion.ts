import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuario } from '@/lib/auth'
import type { Usuario } from '@/types/usuario'

export async function getUsuarioActual(): Promise<Usuario> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const usuario = getUsuario(user.email)
  if (!usuario) redirect('/login?error=sin_acceso')

  return usuario
}

export async function requireSupervisor(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (usuario.rol !== 'supervisor') redirect('/casos')
  return usuario
}
