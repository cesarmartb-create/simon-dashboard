export type Rol = 'admin' | 'gestor' | 'qf'

export interface Usuario {
  email: string
  nombre: string
  rol: Rol
  cliente_id?: string | null
  local?: string | null
  areas?: string[] | null
  // Areas que el usuario VE en solo lectura (separacion ver/gestionar, spec 2b).
  // Ver un modulo = area in (areas ∪ areas_supervisa); gestionar = area in areas.
  areas_supervisa?: string[] | null
}
