export type DireccionAjuste = 'alta' | 'baja'

export const DIRECCIONES_AJUSTE: DireccionAjuste[] = ['alta', 'baja']

export const DIRECCION_AJUSTE_LABEL: Record<DireccionAjuste, string> = {
  alta: 'Alta',
  baja: 'Baja',
}

export type EstadoAjuste = 'pendiente' | 'realizado' | 'anulado'

export const ESTADOS_AJUSTE: EstadoAjuste[] = [
  'pendiente',
  'realizado',
  'anulado',
]

export const ESTADO_AJUSTE_LABEL: Record<EstadoAjuste, string> = {
  pendiente: 'Pendiente',
  realizado: 'Realizado',
  anulado: 'Anulado',
}

export interface TipoAjuste {
  id: string
  cliente_id: string
  codigo: string
  nombre: string
  activo: boolean
  orden: number | null
  created_at?: string
}

export interface AjusteInventario {
  id: string
  cliente_id: string
  local: string
  local_correo: string | null
  reportado_por: string
  tipo_id: string
  direccion: DireccionAjuste
  cantidad_sku: number
  monto: number | null
  folio_origen: string | null
  folio_referencia: string | null
  observacion: string | null
  estado: EstadoAjuste
  folio_ajuste: string | null
  cerrado_por: string | null
  fecha_cierre: string | null
  observacion_cierre: string | null
  created_at: string
  updated_at: string | null
}
