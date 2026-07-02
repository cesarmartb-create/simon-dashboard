import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeGestionarAjustes, AREA_AJUSTES } from '@/lib/ajustes'
import { notificarAjusteRealizado } from '@/lib/notificar'
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
  accion?: 'realizado' | 'anulado'
  folio_ajuste?: string
  monto?: number | null
  observacion_cierre?: string
}

type AjusteConTipo = AjusteInventario & {
  tipos_ajuste: { nombre: string } | null
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

  if (!puedeGestionarAjustes(usuario)) {
    return NextResponse.json(
      { error: 'No tienes permiso para gestionar ajustes' },
      { status: 403 }
    )
  }

  const body = (await request.json()) as Body
  if (body.accion !== 'realizado' && body.accion !== 'anulado') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const { data: ajuste, error: errorFetch } = await supabase
    .from('ajustes_inventario')
    .select('*, tipos_ajuste(nombre)')
    .eq('id', params.id)
    .maybeSingle<AjusteConTipo>()

  if (errorFetch || !ajuste) {
    return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 })
  }
  if (ajuste.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'El ajuste ya no está pendiente' },
      { status: 400 }
    )
  }

  const ahora = new Date().toISOString()
  const observacionCierre = (body.observacion_cierre ?? '').trim() || null

  if (body.accion === 'anulado') {
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

  // accion === 'realizado'
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
  const { data: area } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', usuario.cliente_id ?? 'grupobaco')
    .eq('nombre', AREA_AJUSTES)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()

  // Notificar: local que originó el ajuste + responsable del área + César.
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
    area?.responsable_correo ?? null
  )

  return NextResponse.json({ ok: true })
}
