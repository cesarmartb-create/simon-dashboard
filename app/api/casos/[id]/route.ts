import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsuario, gestionaCasosPropios } from '@/lib/auth'
import { notificarEscalado } from '@/lib/notificar'
import { ESTADOS, type EstadoCaso } from '@/types/caso'

interface Body {
  estado?: EstadoCaso
  observacion?: string
  estado_anterior?: EstadoCaso
  notificar_colaborador?: boolean
  notificar_escalado?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const usuario = getUsuario(user?.email)
  if (!usuario || !user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = (await request.json()) as Body

  if (!body.estado || !ESTADOS.includes(body.estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const observacion = (body.observacion ?? '').trim()
  if (!observacion) {
    return NextResponse.json(
      { error: 'La observación es obligatoria' },
      { status: 400 }
    )
  }

  const { data: caso, error: errorFetch } = await supabase
    .from('casos')
    .select(
      'id, estado, responsable, colaborador_nombre, local, categoria, consulta'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (errorFetch || !caso) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  if (gestionaCasosPropios(usuario.rol) && caso.responsable !== usuario.nombre) {
    return NextResponse.json(
      { error: 'No tienes acceso a este caso' },
      { status: 403 }
    )
  }

  const estadoAnterior = (caso.estado as EstadoCaso) ?? body.estado_anterior
  const nuevoEstado = body.estado
  const ahora = new Date().toISOString()

  // 1. Actualizar el caso.
  const update: Record<string, unknown> = {
    estado: nuevoEstado,
    updated_at: ahora,
  }
  if (nuevoEstado === 'cerrado') {
    update.fecha_cierre = ahora
    update.cerrado_por = usuario.nombre
  }

  const { error: errorUpdate } = await supabase
    .from('casos')
    .update(update)
    .eq('id', params.id)

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  // 2. Registrar el evento de cambio de estado.
  const { error: errorEvento } = await supabase.from('eventos').insert({
    caso_id: params.id,
    tipo: 'cambio_estado',
    detalle: `Estado: ${estadoAnterior} → ${nuevoEstado} | ${observacion}`,
    actor: user.email,
    fecha: ahora,
  })

  if (errorEvento) {
    console.error('[casos] Error insertando evento cambio_estado:', errorEvento)
    return NextResponse.json({ error: errorEvento.message }, { status: 500 })
  }

  // 3. Notificación al colaborador: por ahora solo se deja registrada como
  //    pendiente. La integración real con WhatsApp se construye aparte.
  if (body.notificar_colaborador) {
    const { error: errorPendiente } = await supabase.from('eventos').insert({
      caso_id: params.id,
      tipo: 'notificacion_pendiente',
      detalle: 'Pendiente notificar colaborador por WhatsApp',
      actor: user.email,
      fecha: ahora,
    })

    if (errorPendiente) {
      console.error(
        '[casos] Error insertando evento notificacion_pendiente:',
        errorPendiente
      )
      return NextResponse.json(
        { error: errorPendiente.message },
        { status: 500 }
      )
    }
  }

  // 4. Escalamiento: enviar correo a admins y supervisores.
  if (body.notificar_escalado) {
    await notificarEscalado(
      {
        id: caso.id as string,
        colaborador_nombre: caso.colaborador_nombre as string | null,
        local: caso.local as string | null,
        categoria: caso.categoria as string | null,
        consulta: caso.consulta as string | null,
      },
      observacion,
      user.email
    )
  }

  return NextResponse.json({ ok: true })
}
