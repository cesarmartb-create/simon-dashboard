import type { Rol, Usuario } from '@/types/usuario'
import type { Gestion } from '@/types/gestion'

/** Crea gestiones desde el portal: admin y gestor (nunca qf). */
export function puedeCrearGestion(rol: Rol): boolean {
  return rol === 'admin' || rol === 'gestor'
}

/** Responde/marca leida: el qf, solo lo que corresponde a su propio local. */
export function puedeResponderGestion(usuario: Usuario, fila: Gestion): boolean {
  return usuario.rol === 'qf' && usuario.local === fila.local
}

/** Anula: admin o gestor, en cualquier local. */
export function puedeAnularGestion(usuario: Usuario): boolean {
  return usuario.rol === 'admin' || usuario.rol === 'gestor'
}

/** Reenvia el aviso de plazo al local: admin o gestor, en cualquier local. */
export function puedeReenviarRecordatorio(usuario: Usuario): boolean {
  return usuario.rol === 'admin' || usuario.rol === 'gestor'
}
