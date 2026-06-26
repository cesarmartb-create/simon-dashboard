import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  nombreDesdeEmail,
  puedeVerVistaGlobal,
  puedeAccederConfiguracion,
  esAdmin,
} from '@/lib/auth'
import type { Usuario, Rol } from '@/types/usuario'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

/**
 * Devuelve el usuario logueado combinando:
 *  - email (auth.users)
 *  - nombre (mapa hardcodeado en lib/auth.ts, transitorio)
 *  - rol, cliente_id, local, areas (función SQL perfil_actual())
 *
 * Envuelto en cache() de React para evitar múltiples RPC en la misma request.
 */
export const getUsuarioActual = cache(async (): Promise<Usuario> => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) redirect('/login')

  const { data: perfil, error } = await supabase
    .rpc('perfil_actual')
    .single<PerfilActual>()

  if (error || !perfil) {
    console.error('[sesion] perfil_actual falló o vino vacío:', error)
    redirect('/login?error=sin_acceso')
  }

  if (!perfil.rol || !ROLES_VALIDOS.includes(perfil.rol as Rol)) {
    console.error('[sesion] rol inválido devuelto por perfil_actual:', perfil.rol)
    redirect('/login?error=rol_invalido')
  }

  return {
    email: user.email.toLowerCase(),
    nombre: nombreDesdeEmail(user.email),
    rol: perfil.rol as Rol,
    cliente_id: perfil.cliente_id,
    local: perfil.local,
    areas: perfil.areas,
  }
})

/** Métricas y Equipo: solo admin. */
export async function requireVistaGlobal(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!puedeVerVistaGlobal(usuario.rol)) redirect('/casos')
  return usuario
}

/** Sección Configuración: solo admin. */
export async function requireConfiguracion(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!puedeAccederConfiguracion(usuario.rol)) redirect('/casos')
  return usuario
}

/** Pestañas de Configuración exclusivas de admin (todas). */
export async function requireAdmin(): Promise<Usuario> {
  const usuario = await getUsuarioActual()
  if (!esAdmin(usuario.rol)) redirect('/configuracion/colaboradores')
  return usuario
}
