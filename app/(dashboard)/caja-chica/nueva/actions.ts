'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual } from '@/lib/sesion'
import { puedeCrearRendicion } from '@/lib/cajachica'

interface CrearRendicionInput {
  local: string
  periodo: string
}

interface CrearRendicionResult {
  ok: boolean
  rendicionId?: string
  error?: string
}

/**
 * Borrador acumulativo: si la unidad ya tiene una rendicion 'abierto', la abre;
 * si no, crea una nueva con numero = max+1 dentro de (cliente, local, periodo).
 */
export async function crearOAbrirRendicion(
  input: CrearRendicionInput
): Promise<CrearRendicionResult> {
  const usuario = await getUsuarioActual()

  if (!puedeCrearRendicion(usuario)) {
    return { ok: false, error: 'No tienes permiso para crear rendiciones.' }
  }
  if (!usuario.cliente_id) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }

  // qf: siempre su local. admin: el local seleccionado.
  const local =
    usuario.rol === 'qf' ? (usuario.local ?? '') : (input.local ?? '').trim()
  if (!local) {
    return {
      ok: false,
      error:
        usuario.rol === 'qf'
          ? 'Tu perfil no tiene local asignado.'
          : 'Debes seleccionar un local.',
    }
  }

  const periodo = (input.periodo ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return { ok: false, error: 'Periodo inválido (formato YYYY-MM).' }
  }

  const supabase = createClient()

  // ¿Ya hay un borrador abierto para esta unidad? (una sola a la vez)
  const { data: abierta } = await supabase
    .from('rendiciones_caja_chica')
    .select('id')
    .eq('cliente_id', usuario.cliente_id)
    .eq('local', local)
    .eq('estado', 'abierto')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (abierta) {
    return { ok: true, rendicionId: abierta.id }
  }

  // numero correlativo dentro de (cliente, local, periodo)
  const { data: ultima } = await supabase
    .from('rendiciones_caja_chica')
    .select('numero')
    .eq('cliente_id', usuario.cliente_id)
    .eq('local', local)
    .eq('periodo', periodo)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: number }>()

  const numero = (ultima?.numero ?? 0) + 1

  const { data: rendicion, error } = await supabase
    .from('rendiciones_caja_chica')
    .insert({
      cliente_id: usuario.cliente_id,
      local,
      local_correo: usuario.email,
      reportado_por: usuario.nombre,
      periodo,
      numero,
      estado: 'abierto',
    })
    .select('id')
    .single()

  if (error || !rendicion) {
    return {
      ok: false,
      error: `No se pudo crear la rendición: ${error?.message ?? 'error desconocido'}`,
    }
  }

  return { ok: true, rendicionId: rendicion.id }
}
