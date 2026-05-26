export type Rol = 'supervisor' | 'gestor'

export interface Usuario {
  email: string
  nombre: string
  rol: Rol
}
