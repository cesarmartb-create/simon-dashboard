export type Rol = 'admin' | 'supervisor' | 'operador' | 'gestor'

export interface Usuario {
  email: string
  nombre: string
  rol: Rol
}
