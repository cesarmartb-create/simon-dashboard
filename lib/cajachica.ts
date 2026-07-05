import type { Usuario } from '@/types/usuario'

export const AREA_CAJA_CHICA = 'caja_chica'

/**
 * Gestiona caja chica (revisar / aprobar-rechazar por linea / cerrar / pagar):
 * admin, o gestor con 'caja_chica' en su array `areas`. La supervision
 * (areas_supervisa) NO habilita gestion.
 */
export function puedeGestionarCajaChica(usuario: Usuario): boolean {
  return (
    usuario.rol === 'admin' ||
    (usuario.rol === 'gestor' && (usuario.areas ?? []).includes(AREA_CAJA_CHICA))
  )
}

/**
 * Ve caja chica: qf (su local), admin, o gestor con 'caja_chica' en
 * areas ∪ areas_supervisa (spec 2b: quien solo supervisa ve todo sin botones).
 */
export function puedeVerCajaChica(usuario: Usuario): boolean {
  if (usuario.rol === 'admin' || usuario.rol === 'qf') return true
  const areasVisibles = [
    ...(usuario.areas ?? []),
    ...(usuario.areas_supervisa ?? []),
  ]
  return usuario.rol === 'gestor' && areasVisibles.includes(AREA_CAJA_CHICA)
}

/** Crea rendiciones desde el portal: qf (su local) y admin. */
export function puedeCrearRendicion(usuario: Usuario): boolean {
  return usuario.rol === 'admin' || usuario.rol === 'qf'
}

/**
 * Saldo disponible de una unidad con fondo:
 *   monto_asignado − Σ(total de rendiciones aprobadas/aprobada_parcial aun no pagadas).
 * `totalAprobadoNoPagado` lo calcula el server component sumando esas rendiciones.
 */
export function saldoDisponible(
  montoAsignado: number,
  totalAprobadoNoPagado: number
): number {
  return montoAsignado - totalAprobadoNoPagado
}

/** true si el total supera el fondo (alerta blanda; nunca bloquea). */
export function excedeFondo(
  total: number,
  montoFondo: number | null
): boolean {
  return montoFondo !== null && total > montoFondo
}
