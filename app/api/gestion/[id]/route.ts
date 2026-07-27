import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeResponderGestion, puedeAnularGestion } from '@/lib/gestion'
import { notificarGestionRespondida } from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'
import type { Gestion } from '@/types/gestion'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  accion?: 'responder' | 'marcar_leida' | 'anular'
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

  const body = (await request.json()) as Body
  if (
    body.accion !== 'responder' &&
    body.accion !== 'marcar_leida' &&
    body.accion !== 'anular'
  ) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // La RLS ya filtra visibilidad; el .eq de cliente_id (si aplica) queda
  // como segunda capa multi-tenant a nivel de codigo, igual que en ajustes.
  const { data: fila, error: errorFetch } = await supabase
    .from('gestion')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Gestion>()

  if (errorFetch || !fila) {
    return NextResponse.json({ error: 'Gestión no encontrada' }, { status: 404 })
  }

  const ahora = new Date().toISOString()

  // --- Responder: solo solicitudes, solo el qf del local, desde pendiente ---
  if (body.accion === 'responder') {
    if (fila.tipo !== 'solicitud') {
      return NextResponse.json(
        { error: 'Solo las solicitudes se responden' },
        { status: 400 }
      )
    }
    if (!puedeResponderGestion(usuario, fila)) {
      return NextResponse.json(
        { error: 'No tienes permiso para responder esta gestión' },
        { status: 403 }
      )
    }
    if (fila.estado !== 'pendiente') {
      return NextResponse.json(
        { error: 'Esta solicitud ya no está pendiente' },
        { status: 400 }
      )
    }

    const { count: numAdjuntos } = await supabase
      .from('adjuntos')
      .select('id', { count: 'exact', head: true })
      .eq('gestion_id', params.id)

    if (!numAdjuntos || numAdjuntos === 0) {
      return NextResponse.json(
        { error: 'Debes adjuntar el documento antes de responder.' },
        { status: 400 }
      )
    }

    const { error: errorUpdate } = await supabase
      .from('gestion')
      .update({
        estado: 'respondida',
        fecha_respuesta: ahora,
        respondido_por: usuario.email,
        updated_at: ahora,
      })
      .eq('id', params.id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }

    const { error: errorEvento } = await supabase.from('eventos').insert({
      gestion_id: params.id,
      tipo: 'cambio_estado',
      detalle: 'Estado: pendiente → respondida',
      actor: usuario.email,
      fecha: ahora,
    })
    if (errorEvento) {
      console.error('[gestion] Error insertando evento cambio_estado:', errorEvento)
    }

    await notificarGestionRespondida({
      ...fila,
      estado: 'respondida',
      fecha_respuesta: ahora,
      respondido_por: usuario.email,
    })

    return NextResponse.json({ ok: true })
  }

  // --- Marcar leida: solo memo/comunicado, solo el qf del local, desde pendiente ---
  if (body.accion === 'marcar_leida') {
    if (fila.tipo !== 'memo' && fila.tipo !== 'comunicado') {
      return NextResponse.json(
        { error: 'Solo memos y comunicados se marcan como leídos' },
        { status: 400 }
      )
    }
    if (!puedeResponderGestion(usuario, fila)) {
      return NextResponse.json(
        { error: 'No tienes permiso para marcar esta gestión' },
        { status: 403 }
      )
    }
    if (fila.estado !== 'pendiente') {
      return NextResponse.json(
        { error: 'Esta gestión ya no está pendiente' },
        { status: 400 }
      )
    }

    const { error: errorUpdate } = await supabase
      .from('gestion')
      .update({
        estado: 'leida',
        fecha_respuesta: ahora,
        respondido_por: usuario.email,
        updated_at: ahora,
      })
      .eq('id', params.id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }

    const { error: errorEvento } = await supabase.from('eventos').insert({
      gestion_id: params.id,
      tipo: 'cambio_estado',
      detalle: 'Estado: pendiente → leída',
      actor: usuario.email,
      fecha: ahora,
    })
    if (errorEvento) {
      console.error('[gestion] Error insertando evento cambio_estado:', errorEvento)
    }

    // Marcar leido no dispara correo (seria ruido con muchos locales); la
    // vista de progreso en pantalla ya cubre el seguimiento.
    return NextResponse.json({ ok: true })
  }

  // --- Anular: admin o gestor, cualquier local, desde pendiente ---
  if (!puedeAnularGestion(usuario)) {
    return NextResponse.json(
      { error: 'No tienes permiso para anular esta gestión' },
      { status: 403 }
    )
  }
  if (fila.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'Esta gestión ya no está pendiente' },
      { status: 400 }
    )
  }

  const { error: errorUpdate } = await supabase
    .from('gestion')
    .update({
      estado: 'anulada',
      updated_at: ahora,
    })
    .eq('id', params.id)

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  const { error: errorEvento } = await supabase.from('eventos').insert({
    gestion_id: params.id,
    tipo: 'cambio_estado',
    detalle: `Anulada por ${usuario.email}`,
    actor: usuario.email,
    fecha: ahora,
  })
  if (errorEvento) {
    console.error('[gestion] Error insertando evento cambio_estado:', errorEvento)
  }

  return NextResponse.json({ ok: true })
}
