import type { Usuario, Rol } from '@/types/usuario'

const USUARIOS: Record<string, Omit<Usuario, 'email'>> = {
  'cesar.martinez@grupobaco.cl': { nombre: 'César', rol: 'supervisor' },
  'julia@grupobaco.cl': { nombre: 'Julia', rol: 'supervisor' },
  'helmuth@grupobaco.cl': { nombre: 'Helmuth', rol: 'supervisor' },
  'mariaandrea@grupobaco.cl': { nombre: 'María Andrea', rol: 'gestor' },
  'nayarhet@grupobaco.cl': { nombre: 'Nayarhet', rol: 'gestor' },
  'kathy@grupobaco.cl': { nombre: 'Kathy', rol: 'gestor' },
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

export function esSupervisor(usuario: Usuario | null): boolean {
  return usuario?.rol === 'supervisor'
}
