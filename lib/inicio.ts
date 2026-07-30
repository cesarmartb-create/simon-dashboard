import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyChile } from '@/lib/utils'

export interface ResumenCasos {
  abiertos: number
  escalados: number
}

export interface ResumenAjustes {
  pendientes: number
}

export interface ResumenCajaChica {
  enRevision: number
  excedeFondo: number
}

export interface ResumenGestion {
  pendientes: number
  vencidas: number
}

export async function cargarResumenCasos(
  supabase: SupabaseClient
): Promise<ResumenCasos> {
  const [{ count: abiertos }, { count: escalados }] = await Promise.all([
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .neq('estado', 'cerrado'),
    supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'escalado'),
  ])

  return {
    abiertos: abiertos ?? 0,
    escalados: escalados ?? 0,
  }
}

export async function cargarResumenAjustes(
  supabase: SupabaseClient
): Promise<ResumenAjustes> {
  const { count: pendientes } = await supabase
    .from('ajustes_inventario')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  return {
    pendientes: pendientes ?? 0,
  }
}

export async function cargarResumenCajaChica(
  supabase: SupabaseClient
): Promise<ResumenCajaChica> {
  const [{ count: enRevision }, { count: excedeFondo }] = await Promise.all([
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision'),
    supabase
      .from('rendiciones_caja_chica')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .eq('excede_fondo', true),
  ])

  return {
    enRevision: enRevision ?? 0,
    excedeFondo: excedeFondo ?? 0,
  }
}

export async function cargarResumenGestion(
  supabase: SupabaseClient
): Promise<ResumenGestion> {
  const [{ count: pendientes }, { count: vencidas }] = await Promise.all([
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
  ])

  return {
    pendientes: pendientes ?? 0,
    vencidas: vencidas ?? 0,
  }
}
