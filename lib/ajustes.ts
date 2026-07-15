import type { Usuario } from '@/types/usuario'
import type { EstadoAjuste } from '@/types/ajuste'

export const AREA_AJUSTES = 'ajustes_inventario'
export const AREA_AJUSTES_EJECUCION = 'ajustes_ejecucion'

/**
 * Filtro: admin, o gestor con el área 'ajustes_inventario' en su array areas.
 * Ve todos los ajustes y puede validar / realizar / anular.
 * Un gestor sin área de ajustes no ve ninguno.
 */
export function puedeGestionarAjustes(usuario: Usuario): boolean {
  return (
    usuario.rol === 'admin' ||
    (usuario.rol === 'gestor' && (usuario.areas ?? []).includes(AREA_AJUSTES))
  )
}

/**
 * Ejecutor: gestor con el área 'ajustes_ejecucion'. Realiza (con folio) los
 * ajustes ya validados. NO valida, NO anula, y la RLS le oculta los
 * pendientes sin validar (solo ve estados validado y realizado).
 */
export function esEjecutorAjustes(usuario: Usuario): boolean {
  return (
    usuario.rol === 'gestor' &&
    (usuario.areas ?? []).includes(AREA_AJUSTES_EJECUCION)
  )
}

/** Ve el listado: qf (solo su local), filtro, ejecutor, admin. */
export function puedeVerAjustes(usuario: Usuario): boolean {
  return (
    usuario.rol === 'qf' ||
    puedeGestionarAjustes(usuario) ||
    esEjecutorAjustes(usuario)
  )
}

/** Crea ajustes desde el portal: qf y admin. */
export function puedeCrearAjuste(usuario: Usuario): boolean {
  return usuario.rol === 'admin' || usuario.rol === 'qf'
}

// --- Transiciones de estado (la RLS las fuerza igual en la BD) ---

/** Validar: solo filtro/admin, desde pendiente. */
export function puedeValidarAjuste(
  usuario: Usuario,
  estado: EstadoAjuste
): boolean {
  return puedeGestionarAjustes(usuario) && estado === 'pendiente'
}

/**
 * Realizar con folio: filtro/admin desde pendiente (atajo con validación
 * implícita) o desde validado; ejecutor SOLO desde validado.
 */
export function puedeRealizarAjuste(
  usuario: Usuario,
  estado: EstadoAjuste
): boolean {
  if (puedeGestionarAjustes(usuario)) {
    return estado === 'pendiente' || estado === 'validado'
  }
  if (esEjecutorAjustes(usuario)) {
    return estado === 'validado'
  }
  return false
}

/** Anular (observación obligatoria): solo filtro/admin, desde pendiente o validado. */
export function puedeAnularAjuste(
  usuario: Usuario,
  estado: EstadoAjuste
): boolean {
  return (
    puedeGestionarAjustes(usuario) &&
    (estado === 'pendiente' || estado === 'validado')
  )
}
