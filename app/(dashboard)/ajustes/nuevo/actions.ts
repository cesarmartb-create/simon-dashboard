'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual } from '@/lib/sesion'
import { puedeCrearAjuste, AREA_AJUSTES } from '@/lib/ajustes'
import { notificarNuevoAjuste } from '@/lib/notificar'
import type { DireccionAjuste } from '@/types/ajuste'

interface CrearAjusteInput {
  local: string
  reportadoPor: string
  tipoId: string
  direccion: DireccionAjuste
  cantidadSku: number
  monto: number | null
  folioOrigen: string | null
  folioReferencia: string | null
  observacion: string | null
}

interface CrearAjusteResult {
  ok: boolean
  ajusteId?: string
  error?: string
}

export async function crearAjuste(
  input: CrearAjusteInput
): Promise<CrearAjusteResult> {
  const usuario = await getUsuarioActual()

  if (!puedeCrearAjuste(usuario)) {
    return { ok: false, error: 'No tienes permiso para crear ajustes.' }
  }
  if (!usuario.cliente_id) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }

  // qf: siempre su local. admin: el local seleccionado en el formulario.
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
  if (!input.reportadoPor) {
    return { ok: false, error: 'Debes seleccionar quién reporta.' }
  }
  if (input.direccion !== 'alta' && input.direccion !== 'baja') {
    return { ok: false, error: 'Debes seleccionar la dirección del ajuste.' }
  }
  if (!Number.isInteger(input.cantidadSku) || input.cantidadSku <= 0) {
    return {
      ok: false,
      error: 'La cantidad de SKU debe ser un entero positivo.',
    }
  }
  if (
    input.monto !== null &&
    (typeof input.monto !== 'number' || isNaN(input.monto) || input.monto < 0)
  ) {
    return { ok: false, error: 'El monto debe ser un número positivo.' }
  }

  const supabase = createClient()

  const { data: tipo } = await supabase
    .from('tipos_ajuste')
    .select('id, codigo, nombre')
    .eq('id', input.tipoId)
    .eq('cliente_id', usuario.cliente_id)
    .eq('activo', true)
    .maybeSingle<{ id: string; codigo: string; nombre: string }>()

  if (!tipo) {
    return { ok: false, error: 'Tipo de ajuste inválido.' }
  }

  // Folio de referencia solo aplica a rectificaciones.
  const folioReferencia =
    tipo.codigo === 'rectificacion'
      ? input.folioReferencia?.trim() || null
      : null

  // Responsable del área: siempre desde areas_derivacion, nunca hardcodeado.
  const { data: area } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', usuario.cliente_id)
    .eq('nombre', AREA_AJUSTES)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()

  const responsableCorreo = area?.responsable_correo ?? null

  const { data: ajuste, error } = await supabase
    .from('ajustes_inventario')
    .insert({
      cliente_id: usuario.cliente_id,
      local,
      local_correo: usuario.email,
      reportado_por: input.reportadoPor,
      tipo_id: tipo.id,
      direccion: input.direccion,
      cantidad_sku: input.cantidadSku,
      monto: input.monto,
      folio_origen: input.folioOrigen?.trim() || null,
      folio_referencia: folioReferencia,
      observacion: input.observacion?.trim() || null,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (error || !ajuste) {
    return {
      ok: false,
      error: `No se pudo crear el ajuste: ${error?.message ?? 'error desconocido'}`,
    }
  }

  // Notificar (no bloquea: notificarNuevoAjuste nunca lanza).
  await notificarNuevoAjuste(
    {
      id: ajuste.id,
      local,
      tipoNombre: tipo.nombre,
      direccion: input.direccion,
      cantidadSku: input.cantidadSku,
      monto: input.monto,
      folioOrigen: input.folioOrigen?.trim() || null,
      folioReferencia,
      observacion: input.observacion?.trim() || null,
      reportadoPor: input.reportadoPor,
    },
    responsableCorreo
  )

  return { ok: true, ajusteId: ajuste.id }
}
