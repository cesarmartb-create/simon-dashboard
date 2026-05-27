import type { Usuario, Rol } from '@/types/usuario'

const USUARIOS: Record<string, Omit<Usuario, 'email'>> = {
  'cesar.martinez@grupobaco.cl': { nombre: 'César', rol: 'admin' },
  'julia@grupobaco.cl': { nombre: 'Julia', rol: 'supervisor' },
  'helmuth@grupobaco.cl': { nombre: 'Helmuth', rol: 'supervisor' },
  'mariaandrea@grupobaco.cl': { nombre: 'María Andrea', rol: 'gestor' },
  'nayarhet@grupobaco.cl': { nombre: 'Nayarhet', rol: 'gestor' },
  'kathy@grupobaco.cl': { nombre: 'Kathy', rol: 'operador' },
}

export function getUsuario(email: string | null | undefined): Usuario | null {
  if (!email) return null
  const key = email.toLowerCase()
  const info = USUARIOS[key]
  if (!info) return null
  return { email: key, nombre: info.nombre, rol: info.rol }
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

/** Nombres de quienes pueden ser responsables de un caso (gestores y operadores). */
export function nombresQueGestionanCasos(): string[] {
  return Object.values(USUARIOS)
    .filter((v) => v.rol === 'gestor' || v.rol === 'operador')
    .map((v) => v.nombre)
}

// --- Capacidades por rol ---

export function esAdmin(rol: Rol): boolean {
  return rol === 'admin'
}

/** Ve todos los casos + Métricas + Equipo. */
export function puedeVerVistaGlobal(rol: Rol): boolean {
  return rol === 'admin' || rol === 'supervisor'
}

/** Accede a la sección Configuración. */
export function puedeAccederConfiguracion(rol: Rol): boolean {
  return rol === 'admin' || rol === 'operador'
}

/** Solo ve / edita los casos en los que figura como responsable. */
export function gestionaCasosPropios(rol: Rol): boolean {
  return rol === 'gestor' || rol === 'operador'
}

export function esSupervisor(usuario: Usuario | null): boolean {
  return usuario?.rol === 'supervisor'
}
