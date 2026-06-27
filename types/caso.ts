export type EstadoCaso =
  | 'abierto'
  | 'en_gestion'
  | 'esperando_empleado'
  | 'cerrado'
  | 'escalado'

export const ESTADOS: EstadoCaso[] = [
  'abierto',
  'en_gestion',
  'esperando_empleado',
  'cerrado',
  'escalado',
]

export const ESTADO_LABEL: Record<EstadoCaso, string> = {
  abierto: 'Abierto',
  en_gestion: 'En gestión',
  esperando_empleado: 'Esperando empleado',
  cerrado: 'Cerrado',
  escalado: 'Escalado',
}

export interface Caso {
  id: string
  cliente_id: string | null
  colaborador_id: string | null
  colaborador_nombre: string | null
  colaborador_numero: string | null
  colaborador_cargo: string | null
  reportado_por: string | null
  local: string | null
  consulta: string | null
  categoria: string | null
  responsable: string | null
  estado: EstadoCaso
  nivel_escalamiento: number | null
  fecha_creacion: string | null
  fecha_cierre: string | null
  observaciones: string | null
  cerrado_por: string | null
  created_at: string
  updated_at: string | null
}

export interface Evento {
  id: string
  caso_id: string
  tipo: string
  detalle: string | null
  actor: string | null
  created_at?: string
  fecha?: string
}
