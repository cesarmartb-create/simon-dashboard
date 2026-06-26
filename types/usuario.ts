export type Rol = 'admin' | 'gestor' | 'qf'

export interface Usuario {
  email: string
  nombre: string
  rol: Rol
  cliente_id?: string | null
  local?: string | null
  areas?: string[] | null
}
