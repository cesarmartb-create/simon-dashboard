import { hoyChile } from '@/lib/utils'

export type TipoGestion = 'solicitud' | 'solicitud_simple' | 'memo' | 'comunicado'

export const TIPO_GESTION_LABEL: Record<TipoGestion, string> = {
  solicitud: 'Documental',
  solicitud_simple: 'Solicitudes',
  memo: 'Comunicado Interno',
  comunicado: 'Comunicado Simi',
}

export type EstadoGestion = 'pendiente' | 'respondida' | 'leida' | 'anulada'

export const ESTADO_GESTION_LABEL: Record<EstadoGestion, string> = {
  pendiente: 'Pendiente',
  respondida: 'Respondida',
  leida: 'Leída',
  anulada: 'Anulada',
}

export interface Gestion {
  id: string
  cliente_id: string
  tipo: TipoGestion
  grupo_id: string | null
  local: string
  local_correo: string | null
  titulo: string
  instrucciones: string | null
  creado_por: string
  estado: EstadoGestion
  fecha_limite: string | null
  fecha_respuesta: string | null
  respondido_por: string | null
  folio_externo: string | null
  requiere_adjunto: boolean | null
  ultimo_recordatorio: string | null
  created_at: string
  updated_at: string | null
}

/**
 * "Vencida" no es un estado guardado: es una etiqueta visual (pendiente + fecha_limite
 * pasada), igual que la alerta de dias en Ajustes. No bloquea nada.
 */
export function esVencida(fila: Gestion): boolean {
  return (
    fila.estado === 'pendiente' &&
    fila.fecha_limite !== null &&
    fila.fecha_limite < hoyChile()
  )
}
