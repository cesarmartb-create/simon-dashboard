// Estados canonicos en datos; etiquetas en espanol legible para la UI.

export type EstadoRendicion =
  | 'abierto'
  | 'en_revision'
  | 'aprobada'
  | 'aprobada_parcial'
  | 'rechazada'
  | 'pagado'

export const ESTADOS_RENDICION: EstadoRendicion[] = [
  'abierto',
  'en_revision',
  'aprobada',
  'aprobada_parcial',
  'rechazada',
  'pagado',
]

export const ESTADO_RENDICION_LABEL: Record<EstadoRendicion, string> = {
  abierto: 'Borrador',
  en_revision: 'En revision',
  aprobada: 'Aprobada',
  aprobada_parcial: 'Aprobada parcial',
  rechazada: 'Rechazada',
  pagado: 'Pagada',
}

export type EstadoGasto = 'pendiente' | 'aprobado' | 'rechazado'

export const ESTADOS_GASTO: EstadoGasto[] = [
  'pendiente',
  'aprobado',
  'rechazado',
]

export const ESTADO_GASTO_LABEL: Record<EstadoGasto, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

export type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia'

export const FORMAS_PAGO: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia']

export const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

export interface TipoGasto {
  id: string
  cliente_id: string
  codigo: string
  nombre: string
  activo: boolean
  orden: number | null
  created_at?: string
}

export interface FondoCajaChica {
  id: string
  cliente_id: string
  local: string
  monto_asignado: number
  activo: boolean
  created_at: string
  updated_at: string | null
}

export interface RendicionCajaChica {
  id: string
  cliente_id: string
  local: string
  local_correo: string | null
  reportado_por: string
  periodo: string
  numero: number
  estado: EstadoRendicion
  total: number
  monto_fondo_snapshot: number | null
  excede_fondo: boolean
  aprobado_por: string | null
  fecha_envio: string | null
  fecha_aprobacion: string | null
  observacion_cierre: string | null
  pagado_por: string | null
  fecha_pago: string | null
  created_at: string
  updated_at: string | null
}

export interface GastoCajaChica {
  id: string
  cliente_id: string
  rendicion_id: string
  fecha_gasto: string
  monto: number
  proveedor: string | null
  descripcion: string | null
  tipo_gasto_id: string | null
  forma_pago: FormaPago
  n_documento: string | null
  centro_costo: string | null
  estado: EstadoGasto
  observacion_rechazo: string | null
  created_at: string
}
