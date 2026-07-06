'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual } from '@/lib/sesion'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TIPOS_DOCUMENTO,
  type FormaPago,
  type TipoDocumento,
} from '@/types/cajachica'

interface AgregarGastoInput {
  rendicionId: string
  fechaGasto: string
  monto: number
  proveedor: string | null
  descripcion: string | null
  tipoGastoId: string | null
  empresaId: string | null
  formaPago: FormaPago
  nDocumento: string | null
  tipoDocumento: TipoDocumento
}

interface AgregarGastoResult {
  ok: boolean
  gastoId?: string
  clienteId?: string
  error?: string
}

const FORMAS: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia']

/** N° de documento efectivo: null si el gasto no lleva documento. */
function docEfectivo(
  tipoDocumento: TipoDocumento,
  nDocumento: string | null
): string | null {
  if (tipoDocumento === 'sin_documento') return null
  return nDocumento?.trim() || null
}

/** Valida la empresa (si viene): debe ser del mismo cliente y estar activa. */
async function validarEmpresa(
  supabase: SupabaseClient,
  clienteId: string,
  empresaId: string | null
): Promise<{ ok: boolean; id: string | null; error?: string }> {
  if (!empresaId) return { ok: true, id: null }
  const { data } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', empresaId)
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .maybeSingle<{ id: string }>()
  if (!data) return { ok: false, id: null, error: 'Empresa inválida.' }
  return { ok: true, id: data.id }
}

/**
 * Carga la rendicion validando cliente y que sea editable por el usuario:
 * estado 'abierto' y (admin, o qf de su propio local).
 */
async function rendicionEditable(
  supabase: SupabaseClient,
  clienteId: string,
  rol: string,
  local: string | null | undefined,
  rendicionId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: rendicion } = await supabase
    .from('rendiciones_caja_chica')
    .select('id, estado, local')
    .eq('id', rendicionId)
    .eq('cliente_id', clienteId)
    .maybeSingle<{ id: string; estado: string; local: string }>()

  if (!rendicion) return { ok: false, error: 'Rendición no encontrada.' }
  if (rendicion.estado !== 'abierto') {
    return { ok: false, error: 'La rendición ya no admite cambios en sus gastos.' }
  }
  // Dueno de unidad: admin o cualquier usuario cuyo local sea el de la rendicion.
  const permitido =
    rol === 'admin' || (!!local && rendicion.local === local)
  if (!permitido) {
    return { ok: false, error: 'No puedes editar los gastos de esta rendición.' }
  }
  return { ok: true }
}

/** Recalcula rendiciones_caja_chica.total = suma de sus gastos. */
async function recalcularTotal(
  supabase: SupabaseClient,
  clienteId: string,
  rendicionId: string
): Promise<void> {
  const { data: gastos } = await supabase
    .from('gastos_caja_chica')
    .select('monto')
    .eq('cliente_id', clienteId)
    .eq('rendicion_id', rendicionId)
  const total = (gastos ?? []).reduce(
    (s, g) => s + Number((g as { monto: number }).monto ?? 0),
    0
  )
  await supabase
    .from('rendiciones_caja_chica')
    .update({ total, updated_at: new Date().toISOString() })
    .eq('id', rendicionId)
    .eq('cliente_id', clienteId)
}

export async function agregarGasto(
  input: AgregarGastoInput
): Promise<AgregarGastoResult> {
  const usuario = await getUsuarioActual()
  if (!usuario.cliente_id) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }
  const supabase = createClient()

  const editable = await rendicionEditable(
    supabase,
    usuario.cliente_id,
    usuario.rol,
    usuario.local,
    input.rendicionId
  )
  if (!editable.ok) return { ok: false, error: editable.error }

  if (!input.fechaGasto || !/^\d{4}-\d{2}-\d{2}$/.test(input.fechaGasto)) {
    return { ok: false, error: 'Fecha del gasto inválida.' }
  }
  if (typeof input.monto !== 'number' || isNaN(input.monto) || input.monto <= 0) {
    return { ok: false, error: 'El monto debe ser mayor que cero.' }
  }
  if (!FORMAS.includes(input.formaPago)) {
    return { ok: false, error: 'Forma de pago inválida.' }
  }
  if (!TIPOS_DOCUMENTO.includes(input.tipoDocumento)) {
    return { ok: false, error: 'Tipo de documento inválido.' }
  }

  // El tipo de gasto (si viene) debe ser del mismo cliente y estar activo.
  let tipoGastoId: string | null = null
  if (input.tipoGastoId) {
    const { data: tipo } = await supabase
      .from('tipos_gasto')
      .select('id')
      .eq('id', input.tipoGastoId)
      .eq('cliente_id', usuario.cliente_id)
      .eq('activo', true)
      .maybeSingle<{ id: string }>()
    if (!tipo) return { ok: false, error: 'Tipo de gasto inválido.' }
    tipoGastoId = tipo.id
  }

  const emp = await validarEmpresa(supabase, usuario.cliente_id, input.empresaId)
  if (!emp.ok) return { ok: false, error: emp.error }

  const { data: gasto, error } = await supabase
    .from('gastos_caja_chica')
    .insert({
      cliente_id: usuario.cliente_id,
      rendicion_id: input.rendicionId,
      fecha_gasto: input.fechaGasto,
      monto: input.monto,
      proveedor: input.proveedor?.trim() || null,
      descripcion: input.descripcion?.trim() || null,
      tipo_gasto_id: tipoGastoId,
      empresa_id: emp.id,
      forma_pago: input.formaPago,
      tipo_documento: input.tipoDocumento,
      n_documento: docEfectivo(input.tipoDocumento, input.nDocumento),
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (error || !gasto) {
    return {
      ok: false,
      error: `No se pudo agregar el gasto: ${error?.message ?? 'error desconocido'}`,
    }
  }

  await recalcularTotal(supabase, usuario.cliente_id, input.rendicionId)

  return { ok: true, gastoId: gasto.id, clienteId: usuario.cliente_id }
}

interface EditarGastoInput {
  gastoId: string
  fechaGasto: string
  monto: number
  proveedor: string | null
  descripcion: string | null
  tipoGastoId: string | null
  empresaId: string | null
  formaPago: FormaPago
  nDocumento: string | null
  tipoDocumento: TipoDocumento
}

/**
 * Edita un gasto in-place, solo con el padre en 'abierto' (mismo gate que
 * agregar/eliminar). Conserva la boleta y la observacion_rechazo (no se tocan):
 * asi el QF corrige un gasto arrastrado sin perder su adjunto ni el motivo.
 */
export async function editarGasto(
  input: EditarGastoInput
): Promise<AgregarGastoResult> {
  const usuario = await getUsuarioActual()
  if (!usuario.cliente_id) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }
  const supabase = createClient()

  const { data: gastoActual } = await supabase
    .from('gastos_caja_chica')
    .select('id, rendicion_id')
    .eq('id', input.gastoId)
    .eq('cliente_id', usuario.cliente_id)
    .maybeSingle<{ id: string; rendicion_id: string }>()
  if (!gastoActual) return { ok: false, error: 'Gasto no encontrado.' }

  const editableEdit = await rendicionEditable(
    supabase,
    usuario.cliente_id,
    usuario.rol,
    usuario.local,
    gastoActual.rendicion_id
  )
  if (!editableEdit.ok) return { ok: false, error: editableEdit.error }

  if (!input.fechaGasto || !/^\d{4}-\d{2}-\d{2}$/.test(input.fechaGasto)) {
    return { ok: false, error: 'Fecha del gasto inválida.' }
  }
  if (typeof input.monto !== 'number' || isNaN(input.monto) || input.monto <= 0) {
    return { ok: false, error: 'El monto debe ser mayor que cero.' }
  }
  if (!FORMAS.includes(input.formaPago)) {
    return { ok: false, error: 'Forma de pago inválida.' }
  }
  if (!TIPOS_DOCUMENTO.includes(input.tipoDocumento)) {
    return { ok: false, error: 'Tipo de documento inválido.' }
  }

  let tipoGastoIdEdit: string | null = null
  if (input.tipoGastoId) {
    const { data: tipo } = await supabase
      .from('tipos_gasto')
      .select('id')
      .eq('id', input.tipoGastoId)
      .eq('cliente_id', usuario.cliente_id)
      .eq('activo', true)
      .maybeSingle<{ id: string }>()
    if (!tipo) return { ok: false, error: 'Tipo de gasto inválido.' }
    tipoGastoIdEdit = tipo.id
  }

  const empEdit = await validarEmpresa(supabase, usuario.cliente_id, input.empresaId)
  if (!empEdit.ok) return { ok: false, error: empEdit.error }

  const { error: errorEdit } = await supabase
    .from('gastos_caja_chica')
    .update({
      fecha_gasto: input.fechaGasto,
      monto: input.monto,
      proveedor: input.proveedor?.trim() || null,
      descripcion: input.descripcion?.trim() || null,
      tipo_gasto_id: tipoGastoIdEdit,
      empresa_id: empEdit.id,
      forma_pago: input.formaPago,
      tipo_documento: input.tipoDocumento,
      n_documento: docEfectivo(input.tipoDocumento, input.nDocumento),
    })
    .eq('id', input.gastoId)
    .eq('cliente_id', usuario.cliente_id)

  if (errorEdit) {
    return { ok: false, error: `No se pudo editar el gasto: ${errorEdit.message}` }
  }

  await recalcularTotal(supabase, usuario.cliente_id, gastoActual.rendicion_id)
  return { ok: true, gastoId: input.gastoId, clienteId: usuario.cliente_id }
}

export async function eliminarGasto(
  gastoId: string
): Promise<{ ok: boolean; error?: string }> {
  const usuario = await getUsuarioActual()
  if (!usuario.cliente_id) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }
  const supabase = createClient()

  const { data: gasto } = await supabase
    .from('gastos_caja_chica')
    .select('id, rendicion_id')
    .eq('id', gastoId)
    .eq('cliente_id', usuario.cliente_id)
    .maybeSingle<{ id: string; rendicion_id: string }>()
  if (!gasto) return { ok: false, error: 'Gasto no encontrado.' }

  const editable = await rendicionEditable(
    supabase,
    usuario.cliente_id,
    usuario.rol,
    usuario.local,
    gasto.rendicion_id
  )
  if (!editable.ok) return { ok: false, error: editable.error }

  const { error } = await supabase
    .from('gastos_caja_chica')
    .delete()
    .eq('id', gastoId)
    .eq('cliente_id', usuario.cliente_id)
  if (error) {
    return { ok: false, error: `No se pudo eliminar el gasto: ${error.message}` }
  }

  await recalcularTotal(supabase, usuario.cliente_id, gasto.rendicion_id)
  return { ok: true }
}
