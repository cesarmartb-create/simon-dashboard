import type { Usuario } from '@/types/usuario'

export const AREA_AJUSTES = 'ajustes_inventario'

/**
 * Admin, o gestor con el área 'ajustes_inventario' en su array areas:
 * ve todos los ajustes y puede gestionarlos (realizar / anular).
 * Un gestor sin el área no ve ninguno.
 */
export function puedeGestionarAjustes(usuario: Usuario): boolean {
  return (
    usuario.rol === 'admin' ||
    (usuario.rol === 'gestor' && (usuario.areas ?? []).includes(AREA_AJUSTES))
  )
}

/** Ve el listado: qf (solo su local), gestor con el área, admin. */
export function puedeVerAjustes(usuario: Usuario): boolean {
  return usuario.rol === 'qf' || puedeGestionarAjustes(usuario)
}

/** Crea ajustes desde el portal: qf y admin. */
export function puedeCrearAjuste(usuario: Usuario): boolean {
  return usuario.rol === 'admin' || usuario.rol === 'qf'
}
