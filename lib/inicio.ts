import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyChile } from '@/lib/utils'

export interface ResumenCasos {
  abierto: number
  enGestion: number
  esperandoEmpleado: number
  escalado: number
  total: number
}

export interface ResumenAjustes {
  pendiente: number
  validado: number
  total: number
}

export interface ResumenCajaChica {
  enRevision: number
  aprobada: number
  aprobadaParcial: number
  total: number
  excedeFondo: number
}

export interface ResumenGestion {
  pendientes: number
  vencidas: number
  documental: number
  solicitudes: number
  comunicadoInterno: number
  comunicadoSimi: number
  envios: number
}

export async function cargarResumenCasos(
  supabase: SupabaseClient
): Promise<ResumenCasos> {
  const [
    { count: abierto },
    { count: enGestion },
    { count: esperandoEmpleado },
    { count: escalado },
  ] = await Promise.all([
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'abierto'),
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_gestion'),
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'esperando_empleado'),
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'escalado'),
  ])

  return {
    abierto: abierto ?? 0,
    enGestion: enGestion ?? 0,
    esperandoEmpleado: esperandoEmpleado ?? 0,
    escalado: escalado ?? 0,
    total: (abierto ?? 0) + (enGestion ?? 0) + (esperandoEmpleado ?? 0) + (escalado ?? 0),
  }
}

export async function cargarResumenAjustes(
  supabase: SupabaseClient
): Promise<ResumenAjustes> {
  const [{ count: pendiente }, { count: validado }] = await Promise.all([
    supabase
      .from('ajustes_inventario')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    supabase
      .from('ajustes_inventario')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'validado'),
  ])

  return {
    pendiente: pendiente ?? 0,
    validado: validado ?? 0,
    total: (pendiente ?? 0) + (validado ?? 0),
  }
}

export async function cargarResumenCajaChica(
  supabase: SupabaseClient
): Promise<ResumenCajaChica> {
  const [
    { count: enRevision },
    { count: aprobada },
    { count: aprobadaParcial },
    { count: excedeFondo },
  ] = await Promise.all([
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision'),
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'aprobada'),
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'aprobada_parcial'),
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['en_revision', 'aprobada', 'aprobada_parcial'])
      .eq('excede_fondo', true),
  ])

  return {
    enRevision: enRevision ?? 0,
    aprobada: aprobada ?? 0,
    aprobadaParcial: aprobadaParcial ?? 0,
    total: (enRevision ?? 0) + (aprobada ?? 0) + (aprobadaParcial ?? 0),
    excedeFondo: excedeFondo ?? 0,
  }
}

export async function cargarResumenGestion(
  supabase: SupabaseClient
): Promise<ResumenGestion> {
  const [
    { count: pendientes },
    { count: vencidas },
    { count: documental },
    { count: solicitudes },
    { count: comunicadoInterno },
    { count: comunicadoSimi },
  ] = await Promise.all([
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .not('fecha_limite', 'is', null)
      .lt('fecha_limite', hoyChile()),
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('tipo', 'solicitud'),
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('tipo', 'solicitud_simple'),
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('tipo', 'memo'),
    supabase
      .from('gestion')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('tipo', 'comunicado'),
  ])

  const { data: filasGrupo } = await supabase
    .from('gestion')
    .select('grupo_id')
    .eq('estado', 'pendiente')

  const gruposUnicos = new Set(
    (filasGrupo ?? []).map((f) => f.grupo_id).filter((g): g is string => g !== null)
  )
  const individuales = (filasGrupo ?? []).filter((f) => f.grupo_id === null).length
  const envios = gruposUnicos.size + individuales

  return {
    pendientes: pendientes ?? 0,
    vencidas: vencidas ?? 0,
    documental: documental ?? 0,
    solicitudes: solicitudes ?? 0,
    comunicadoInterno: comunicadoInterno ?? 0,
    comunicadoSimi: comunicadoSimi ?? 0,
    envios,
  }
}
