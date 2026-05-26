import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsuario } from '@/lib/auth'
import { ESTADOS, type EstadoCaso } from '@/types/caso'

interface Body {
  estado?: EstadoCaso
  observaciones?: string
  detalle?: string
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
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = (await request.json()) as Body

  if (body.estado && !ESTADOS.includes(body.estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const { data: casoExistente, error: errorFetch } = await supabase
    .from('casos')
    .select('id, estado, responsable, observaciones')
    .eq('id', params.id)
    .maybeSingle()

  if (errorFetch || !casoExistente) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  if (
    usuario.rol === 'gestor' &&
    casoExistente.responsable !== usuario.nombre
  ) {
    return NextResponse.json(
      { error: 'No tienes acceso a este caso' },
      { status: 403 }
    )
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  const cambios: string[] = []

  if (body.estado && body.estado !== casoExistente.estado) {
    update.estado = body.estado
    cambios.push(`estado: ${casoExistente.estado} → ${body.estado}`)

    if (body.estado === 'cerrado') {
      update.fecha_cierre = new Date().toISOString()
      update.cerrado_por = usuario.nombre
    }
  }

  if (
    body.observaciones !== undefined &&
    body.observaciones !== (casoExistente.observaciones ?? '')
  ) {
    update.observaciones = body.observaciones
    cambios.push('observaciones actualizadas')
  }

  if (cambios.length === 0) {
    return NextResponse.json({ ok: true, cambios: [] })
  }

  const { error: errorUpdate } = await supabase
    .from('casos')
    .update(update)
    .eq('id', params.id)

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  const tipoEvento =
    body.estado && body.estado !== casoExistente.estado
      ? `cambio_estado:${body.estado}`
      : 'actualizacion'

  const detalle = body.detalle?.trim()
    ? `${cambios.join(' · ')} — ${body.detalle.trim()}`
    : cambios.join(' · ')

  await supabase.from('eventos').insert({
    caso_id: params.id,
    tipo: tipoEvento,
    detalle,
    actor: usuario.nombre,
  })

  return NextResponse.json({ ok: true, cambios })
}
