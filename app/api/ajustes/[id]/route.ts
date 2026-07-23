import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  puedeGestionarAjustes,
  esEjecutorAjustes,
  puedeValidarAjuste,
  puedeRealizarAjuste,
  puedeAnularAjuste,
  AREA_AJUSTES,
  AREA_AJUSTES_EJECUCION,
} from '@/lib/ajustes'
import {
  notificarAjusteRealizado,
  notificarAjusteValidado,
} from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'
import type { AjusteInventario } from '@/types/ajuste'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  accion?: 'validado' | 'realizado' | 'anulado'
  folio_ajuste?: string
  monto?: number | null
  observacion_cierre?: string
}

type AjusteConTipo = AjusteInventario & {
  tipos_ajuste: { nombre: string } | null
}

/** Correo del responsable de un área de derivación (null si no hay). */
async function responsableDeArea(
  supabase: ReturnType<typeof createClient>,
  clienteId: string,
  area: string
): Promise<string | null> {
  const { data } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', clienteId)
    .eq('nombre', area)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()
  return data?.responsable_correo ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .rpc('perfil_actual')
    .single<PerfilActual>()

  if (
    errorPerfil ||
    !perfil ||
    !perfil.rol ||
    !ROLES_VALIDOS.includes(perfil.rol as Rol)
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const usuario: Usuario = {
    email: user.email.toLowerCase(),
    nombre: user.email,
    rol: perfil.rol as Rol,
    cliente_id: perfil.cliente_id,
    local: perfil.local,
    areas: perfil.areas,
  }

  // Gate grueso: filtro/admin o ejecutor. La transición exacta se valida
  // más abajo contra el estado actual del ajuste.
  if (!puedeGestionarAjustes(usuario) && !esEjecutorAjustes(usuario)) {
    return NextResponse.json(
      { error: 'No tienes permiso para gestionar ajustes' },
      { status: 403 }
    )
  }
  if (!usuario.cliente_id) {
    return NextResponse.json(
      { error: 'Tu perfil no tiene cliente asignado' },
      { status: 401 }
    )
  }

  const body = (await request.json()) as Body
  if (
    body.accion !== 'validado' &&
    body.accion !== 'realizado' &&
    body.accion !== 'anulado'
  ) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // La RLS ya filtra por rol/estado (el ejecutor no ve pendientes); el
  // .eq de cliente_id es la segunda capa multi-tenant en código.
  const { data: ajuste, error: errorFetch } = await supabase
    .from('ajustes_inventario')
    .select('*, tipos_ajuste(nombre)')
    .eq('id', params.id)
    .eq('cliente_id', usuario.cliente_id)
    .maybeSingle<AjusteConTipo>()

  if (errorFetch || !ajuste) {
    return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 })
  }

  const ahora = new Date().toISOString()
  const observacionCierre = (body.observacion_cierre ?? '').trim() || null

  // --- Validar: solo filtro/admin, desde pendiente ---
  if (body.accion === 'validado') {
    if (!puedeValidarAjuste(usuario, ajuste.estado)) {
      return NextResponse.json(
        ajuste.estado !== 'pendiente'
          ? { error: 'El ajuste ya no está pendiente' }
          : { error: 'No tienes permiso para validar ajustes' },
        { status: ajuste.estado !== 'pendiente' ? 400 : 403 }
      )
    }

    const { error: errorUpdate } = await supabase
      .from('ajustes_inventario')
      .update({
        estado: 'validado',
        validado_por: usuario.email,
        fecha_validacion: ahora,
        updated_at: ahora,
      })
      .eq('id', params.id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }

    // Evento de timeline. Si falla, el cambio de estado ya quedó aplicado:
    // se loguea y no se aborta (a diferencia de casos, aquí el evento es
    // auditoría secundaria de validado_por/fecha_validacion).
    const { error: errorEvento } = await supabase.from('eventos').insert({
      ajuste_id: params.id,
      tipo: 'ajuste_validado',
      detalle: 'Estado: pendiente → validado',
      actor: usuario.email,
      fecha: ahora,
    })
    if (errorEvento) {
      console.error('[ajustes] Error insertando evento ajuste_validado:', errorEvento)
    }

    const ejecutorCorreo = await responsableDeArea(
      supabase,
      usuario.cliente_id,
      AREA_AJUSTES_EJECUCION
    )

    await notificarAjusteValidado(
      {
        id: ajuste.id,
        local: ajuste.local,
        tipoNombre: ajuste.tipos_ajuste?.nombre ?? '—',
        direccion: ajuste.direccion,
        cantidadSku: ajuste.cantidad_sku,
        monto: ajuste.monto,
        folioOrigen: ajuste.folio_origen,
        folioReferencia: ajuste.folio_referencia,
        observacion: ajuste.observacion,
      },
      usuario.email,
      ejecutorCorreo
    )

    return NextResponse.json({ ok: true })
  }

  // --- Anular: solo filtro/admin, desde pendiente o validado ---
  if (body.accion === 'anulado') {
    if (!puedeAnularAjuste(usuario, ajuste.estado)) {
      return NextResponse.json(
        ajuste.estado === 'realizado' || ajuste.estado === 'anulado'
          ? { error: 'El ajuste ya no se puede anular' }
          : { error: 'No tienes permiso para anular ajustes' },
        { status: ajuste.estado === 'realizado' || ajuste.estado === 'anulado' ? 400 : 403 }
      )
    }
    if (!observacionCierre) {
      return NextResponse.json(
        { error: 'La observación es obligatoria para anular' },
        { status: 400 }
      )
    }

    const { error: errorUpdate } = await supabase
      .from('ajustes_inventario')
      .update({
        estado: 'anulado',
        cerrado_por: usuario.email,
        fecha_cierre: ahora,
        observacion_cierre: observacionCierre,
        updated_at: ahora,
      })
      .eq('id', params.id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // --- Realizar: filtro/admin desde pendiente o validado; ejecutor solo desde validado ---
  if (!puedeRealizarAjuste(usuario, ajuste.estado)) {
    return NextResponse.json(
      ajuste.estado === 'realizado' || ajuste.estado === 'anulado'
        ? { error: 'El ajuste ya no está abierto' }
        : { error: 'El ajuste aún no está validado' },
      { status: 400 }
    )
  }

  const folio = (body.folio_ajuste ?? '').trim()
  if (!folio) {
    return NextResponse.json(
      { error: 'El folio del ajuste es obligatorio' },
      { status: 400 }
    )
  }

  let monto: number | null = null
  if (body.monto !== undefined && body.monto !== null) {
    if (
      typeof body.monto !== 'number' ||
      isNaN(body.monto) ||
      body.monto < 0
    ) {
      return NextResponse.json(
        { error: 'El monto debe ser un número positivo' },
        { status: 400 }
      )
    }
    monto = body.monto
  }

  // Realizar directo desde pendiente (filtro/admin) = validación implícita:
  // se estampa validado_por/fecha_validacion con el mismo actor, así todo
  // 'realizado' queda con su validación registrada.
  const validacionImplicita =
    ajuste.estado === 'pendiente'
      ? { validado_por: usuario.email, fecha_validacion: ahora }
      : {}

  const { error: errorUpdate } = await supabase
    .from('ajustes_inventario')
    .update({
      estado: 'realizado',
      folio_ajuste: folio,
      monto,
      cerrado_por: usuario.email,
      fecha_cierre: ahora,
      observacion_cierre: observacionCierre,
      updated_at: ahora,
      ...validacionImplicita,
    })
    .eq('id', params.id)

  if (errorUpdate) {
    // Violación del índice único (cliente_id, local, folio_ajuste).
    if (errorUpdate.code === '23505') {
      return NextResponse.json(
        { error: 'Ese folio ya está registrado para este local' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  // Responsable del área al momento de enviar (la tabla de ajustes no lo guarda).
  const responsableCorreo = await responsableDeArea(
    supabase,
    usuario.cliente_id,
    AREA_AJUSTES
  )

  // Conteo real de adjuntos para la linea "Incluye N archivo(s)" del correo.
  const { count: numAdjuntos } = await supabase
    .from('adjuntos')
    .select('id', { count: 'exact', head: true })
    .eq('ajuste_id', params.id)

  // Notificar: local que originó el ajuste + responsable del área + copia permanente.
  await notificarAjusteRealizado(
    {
      id: ajuste.id,
      local: ajuste.local,
      tipoNombre: ajuste.tipos_ajuste?.nombre ?? '—',
      direccion: ajuste.direccion,
      cantidadSku: ajuste.cantidad_sku,
      monto,
      folioAjuste: folio,
      localCorreo: ajuste.local_correo,
    },
    usuario.email,
    observacionCierre,
    responsableCorreo,
    numAdjuntos ?? 0
  )

  return NextResponse.json({ ok: true })
}
