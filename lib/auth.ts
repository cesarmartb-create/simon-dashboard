import type { Usuario, Rol } from '@/types/usuario'

/**
 * Mapa transitorio email→nombre/rol.
 * Sobrevive a la migración a `usuarios_cliente` porque:
 *  (a) lib/supabase/middleware.ts aún consulta este mapa como gate sincrónico, y
 *  (b) la función SQL `perfil_actual()` no devuelve nombre.
 * Se elimina cuando migremos middleware y tengamos `nombre` en la BD.
 */
const USUARIOS: Record<string, Omit<Usuario, 'email'>> = {
  'cesar.martinez@grupobaco.cl': { nombre: 'César', rol: 'admin' },
  'julia@grupobaco.cl': { nombre: 'Julia', rol: 'admin' },
  'helmuth@grupobaco.cl': { nombre: 'Helmuth', rol: 'admin' },
  'mariaandrea@grupobaco.cl': { nombre: 'María Andrea', rol: 'gestor' },
  'nayarhet@grupobaco.cl': { nombre: 'Nayarhet', rol: 'gestor' },
  // Kathy queda fuera del piloto (rol 'operador' descontinuado).
}

export function getUsuario(email: string | null | undefined): Usuario | null {
  if (!email) return null
  const key = email.toLowerCase()
  const info = USUARIOS[key]
  if (!info) return null
  return { email: key, nombre: info.nombre, rol: info.rol }
}

/** Resuelve el nombre conocido de un email. Cae al email si no está mapeado. */
export function nombreDesdeEmail(email: string): string {
  return USUARIOS[email.toLowerCase()]?.nombre ?? email
}

export function emailsPorRol(rol: Rol): string[] {
  return Object.entries(USUARIOS)
    .filter(([, v]) => v.rol === rol)
    .map(([email]) => email)
}

export function nombresPorRol(rol: Rol): string[] {
  return Object.values(USUARIOS)
    .filter((v) => v.rol === rol)
    .map((v) => v.nombre)
}

/** Nombres de quienes pueden figurar como responsables de un caso (gestores). */
export function nombresQueGestionanCasos(): string[] {
  return nombresPorRol('gestor')
}

/** Resuelve el email de un usuario a partir de su nombre. Null si no está registrado. */
export function emailPorNombre(nombre: string | null | undefined): string | null {
  if (!nombre) return null
  const entry = Object.entries(USUARIOS).find(([, v]) => v.nombre === nombre)
  return entry ? entry[0] : null
}

// --- Capacidades por rol ---

export function esAdmin(rol: Rol): boolean {
  return rol === 'admin'
}

/** Ve Métricas y Equipo (vista global). */
export function puedeVerVistaGlobal(rol: Rol): boolean {
  return rol === 'admin'
}

/** Accede a la sección Configuración. */
export function puedeAccederConfiguracion(rol: Rol): boolean {
  return rol === 'admin'
}

/**
 * Históricamente true para gestor/operador (filtraban casos por responsable=nombre).
 * En el modelo nuevo el filtrado se hace por RLS en la BD (local para qf, areas
 * para gestor), así que este helper retorna false para todos. Lo mantengo
 * funcional para no tocar las páginas que aún lo invocan.
 */
export function gestionaCasosPropios(_rol: Rol): boolean {
  return false
}

/** Puede crear nuevas solicitudes/casos desde el portal. */
export function puedeCrearCaso(rol: Rol): boolean {
  return rol === 'admin' || rol === 'qf'
}
