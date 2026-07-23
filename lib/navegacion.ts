import type { Usuario } from '@/types/usuario'
import { AREA_AJUSTES, AREA_AJUSTES_EJECUCION, puedeVerAjustes } from '@/lib/ajustes'
import { AREA_CAJA_CHICA, puedeVerCajaChica } from '@/lib/cajachica'

// Areas que "gobiernan" un modulo propio. El resto de las areas son de
// categorias de casos.
const AREAS_MODULO = [AREA_AJUSTES, AREA_AJUSTES_EJECUCION, AREA_CAJA_CHICA]

/**
 * Casos: admin y qf siempre; gestor si tiene alguna area (en areas ∪
 * areas_supervisa) que NO sea de modulo (Ajustes/Caja chica).
 * Ej: Maria Andrea (operaciones + supervisa ajustes) conserva Casos.
 */
export function puedeVerCasos(usuario: Usuario): boolean {
  if (usuario.rol === 'admin' || usuario.rol === 'qf') return true
  const areas = [...(usuario.areas ?? []), ...(usuario.areas_supervisa ?? [])]
  return usuario.rol === 'gestor' && areas.some((a) => !AREAS_MODULO.includes(a))
}

export function rutaInicio(usuario: Usuario): string {
  if (puedeVerCasos(usuario)) return '/casos'
  if (puedeVerAjustes(usuario)) return '/ajustes'
  if (puedeVerCajaChica(usuario)) return '/caja-chica'
  return '/casos'
}
