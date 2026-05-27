import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getUsuario,
  puedeVerVistaGlobal,
  puedeAccederConfiguracion,
  esAdmin,
} from '@/lib/auth'
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

/** Métricas y Equipo: admin o supervisor. */
export async function requireVistaGlobal(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!puedeVerVistaGlobal(usuario.rol)) redirect('/casos')
  return usuario
}

/** Sección Configuración: admin u operador. */
export async function requireConfiguracion(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!puedeAccederConfiguracion(usuario.rol)) redirect('/casos')
  return usuario
}

/** Pestañas de Configuración exclusivas de admin (Derivaciones, Locales, Agente). */
export async function requireAdmin(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!esAdmin(usuario.rol)) redirect('/configuracion/colaboradores')
  return usuario
}
