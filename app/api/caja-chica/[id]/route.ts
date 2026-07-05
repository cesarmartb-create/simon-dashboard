import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeGestionarCajaChica, AREA_CAJA_CHICA } from '@/lib/cajachica'
import {
  notificarRendicionEnviada,
  notificarRendicionResuelta,
} from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'
import type { EstadoRendicion } from '@/types/cajachica'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  accion?: 'enviar' | 'revisar_gasto' | 'cerrar' | 'pagar'
  gasto_id?: string
  decision?: 'aprobado' | 'rechazado'
  observacion_rechazo?: string
  observacion_cierre?: string
}

interface RendicionRow {
  id: string
  cliente_id: string
  local: string
  local_correo: string | null
  reportado_por: string | null
  periodo: string
  numero: number
  estado: EstadoRendicion
  total: number
  monto_fondo_snapshot: number | null
}

// IMPORTANTE (correccion #2): se usa el cliente Supabase de SESION del usuario
// (createClient del server, cookie del usuario). Nunca service role: la RPC
// cerrar_rendicion resuelve al llamador via auth.uid() y con service role
// devolveria sin_perfil. Ademas asi la RLS aplica como segunda capa.

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

  // Aislamiento (requisito 1): sin cliente_id se falla cerrado, sin fallback.
  if (!perfil.cliente_id) {
    return NextResponse.json(
      { error: 'Tu perfil no tiene cliente asignado.' },
      { status: 403 }
    )
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
  const acciones = ['enviar', 'revisar_gasto', 'cerrar', 'pagar']
  if (!body.accion || !acciones.includes(body.accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // Rendicion, siempre acotada al cliente del usuario (fetch con cliente_id).
  const { data: rendicion, error: errorFetch } = await supabase
    .from('rendiciones_caja_chica')
    .select(
      'id, cliente_id, local, local_correo, reportado_por, periodo, numero, estado, total, monto_fondo_snapshot'
    )
    .eq('id', params.id)
    .eq('cliente_id', usuario.cliente_id)
    .maybeSingle<RendicionRow>()

  if (errorFetch || !rendicion) {
    return NextResponse.json(
      { error: 'Rendición no encontrada' },
      { status: 404 }
    )
  }

  const ahora = new Date().toISOString()

  // ------------------------------------------------------------------
  // ENVIAR: abierto -> en_revision (qf de su local o admin)
  // ------------------------------------------------------------------
  if (body.accion === 'enviar') {
    const puedeEnviar =
      usuario.rol === 'admin' ||
      (usuario.rol === 'qf' && rendicion.local === (usuario.local ?? ''))
    if (!puedeEnviar) {
      return NextResponse.json(
        { error: 'No puedes enviar esta rendición' },
        { status: 403 }
      )
    }
    if (rendicion.estado !== 'abierto') {
      return NextResponse.json(
        { error: 'La rendición ya fue enviada' },
        { status: 400 }
      )
    }

    // Correccion #4: debe tener al menos un gasto.
    const { data: gastos } = await supabase
      .from('gastos_caja_chica')
      .select('monto')
      .eq('rendicion_id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)
    if (!gastos || gastos.length === 0) {
      return NextResponse.json(
        { error: 'Agrega al menos un gasto antes de enviar.' },
        { status: 400 }
      )
    }
    const total = gastos.reduce((s, g) => s + Number(g.monto ?? 0), 0)

    // Fondo vigente de la unidad (o null si no tiene fila activa).
    const { data: fondo } = await supabase
      .from('fondos_caja_chica')
      .select('monto_asignado')
      .eq('cliente_id', usuario.cliente_id)
      .eq('local', rendicion.local)
      .eq('activo', true)
      .maybeSingle<{ monto_asignado: number }>()

    const montoFondo = fondo?.monto_asignado ?? null
    const excedeFondo = montoFondo !== null && total > montoFondo

    const { error: errorUpdate } = await supabase
      .from('rendiciones_caja_chica')
      .update({
        estado: 'en_revision',
        total,
        monto_fondo_snapshot: montoFondo,
        excede_fondo: excedeFondo,
        fecha_envio: ahora,
        updated_at: ahora,
      })
      .eq('id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }

    // Responsable del area caja_chica (para el correo).
    const { data: area } = await supabase
      .from('areas_derivacion')
      .select('responsable_correo')
      .eq('cliente_id', usuario.cliente_id)
      .eq('nombre', AREA_CAJA_CHICA)
      .eq('activo', true)
      .maybeSingle<{ responsable_correo: string | null }>()

    await notificarRendicionEnviada(
      {
        id: rendicion.id,
        local: rendicion.local,
        periodo: rendicion.periodo,
        numero: rendicion.numero,
        total,
        montoFondoSnapshot: montoFondo,
        excedeFondo,
        reportadoPor: rendicion.reportado_por,
      },
      area?.responsable_correo ?? null,
      gastos.length
    )

    return NextResponse.json({ ok: true, excede_fondo: excedeFondo })
  }

  // ------------------------------------------------------------------
  // REVISAR_GASTO: aprobar/rechazar una linea (admin o gestor caja_chica)
  // ------------------------------------------------------------------
  if (body.accion === 'revisar_gasto') {
    if (!puedeGestionarCajaChica(usuario)) {
      return NextResponse.json(
        { error: 'No tienes permiso para revisar gastos' },
        { status: 403 }
      )
    }
    if (rendicion.estado !== 'en_revision') {
      return NextResponse.json(
        { error: 'La rendición no está en revisión' },
        { status: 400 }
      )
    }
    if (body.decision !== 'aprobado' && body.decision !== 'rechazado') {
      return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 })
    }
    if (!body.gasto_id) {
      return NextResponse.json({ error: 'Falta el gasto' }, { status: 400 })
    }
    const observacion = (body.observacion_rechazo ?? '').trim() || null
    if (body.decision === 'rechazado' && !observacion) {
      return NextResponse.json(
        { error: 'La observación es obligatoria para rechazar' },
        { status: 400 }
      )
    }

    const { data: gasto } = await supabase
      .from('gastos_caja_chica')
      .select('id')
      .eq('id', body.gasto_id)
      .eq('cliente_id', usuario.cliente_id)
      .eq('rendicion_id', rendicion.id)
      .maybeSingle<{ id: string }>()
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    const { error: errorUpdate } = await supabase
      .from('gastos_caja_chica')
      .update({
        estado: body.decision,
        observacion_rechazo: body.decision === 'rechazado' ? observacion : null,
      })
      .eq('id', body.gasto_id)
      .eq('cliente_id', usuario.cliente_id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ------------------------------------------------------------------
  // CERRAR: -> aprobada / aprobada_parcial / rechazada (RPC atomica)
  // ------------------------------------------------------------------
  if (body.accion === 'cerrar') {
    if (!puedeGestionarCajaChica(usuario)) {
      return NextResponse.json(
        { error: 'No tienes permiso para cerrar rendiciones' },
        { status: 403 }
      )
    }
    const observacion = (body.observacion_cierre ?? '').trim() || null

    // Conteos ANTES del cierre (la RPC mueve los rechazados fuera).
    const { data: gastosEstados } = await supabase
      .from('gastos_caja_chica')
      .select('estado')
      .eq('rendicion_id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)
    const aprobados =
      gastosEstados?.filter((g) => g.estado === 'aprobado').length ?? 0
    const rechazados =
      gastosEstados?.filter((g) => g.estado === 'rechazado').length ?? 0

    const { data: estadoFinal, error: errorRpc } = await supabase.rpc(
      'cerrar_rendicion',
      { p_rendicion_id: rendicion.id, p_observacion: observacion }
    )

    if (errorRpc) {
      const msg = errorRpc.message ?? ''
      if (msg.includes('no_autorizado')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      if (msg.includes('gastos_pendientes')) {
        return NextResponse.json(
          { error: 'Quedan gastos sin revisar.' },
          { status: 400 }
        )
      }
      if (msg.includes('estado_invalido')) {
        return NextResponse.json(
          { error: 'La rendición no está en revisión.' },
          { status: 400 }
        )
      }
      if (
        msg.includes('rendicion_no_encontrada') ||
        msg.includes('otro_cliente')
      ) {
        return NextResponse.json(
          { error: 'Rendición no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'No se pudo cerrar la rendición.' }, {
        status: 500,
      })
    }

    const final = (estadoFinal as EstadoRendicion) ?? 'aprobada'

    // Refrescar total y datos post-cierre para el correo.
    const { data: cerrada } = await supabase
      .from('rendiciones_caja_chica')
      .select('total, local, local_correo, periodo, numero')
      .eq('id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)
      .maybeSingle<{
        total: number
        local: string
        local_correo: string | null
        periodo: string
        numero: number
      }>()

    const { data: area } = await supabase
      .from('areas_derivacion')
      .select('responsable_correo')
      .eq('cliente_id', usuario.cliente_id)
      .eq('nombre', AREA_CAJA_CHICA)
      .eq('activo', true)
      .maybeSingle<{ responsable_correo: string | null }>()

    await notificarRendicionResuelta(
      {
        id: rendicion.id,
        local: cerrada?.local ?? rendicion.local,
        periodo: cerrada?.periodo ?? rendicion.periodo,
        numero: cerrada?.numero ?? rendicion.numero,
        total: cerrada?.total ?? 0,
        localCorreo: cerrada?.local_correo ?? rendicion.local_correo,
      },
      final,
      usuario.email,
      observacion,
      area?.responsable_correo ?? null,
      aprobados,
      rechazados
    )

    return NextResponse.json({ ok: true, estado: final })
  }

  // ------------------------------------------------------------------
  // PAGAR: aprobada/aprobada_parcial -> pagado (admin o gestor caja_chica)
  // Exige comprobante adjunto a la rendicion (decision #2).
  // ------------------------------------------------------------------
  if (body.accion === 'pagar') {
    if (!puedeGestionarCajaChica(usuario)) {
      return NextResponse.json(
        { error: 'No tienes permiso para pagar rendiciones' },
        { status: 403 }
      )
    }
    if (
      rendicion.estado !== 'aprobada' &&
      rendicion.estado !== 'aprobada_parcial'
    ) {
      return NextResponse.json(
        { error: 'La rendición no está lista para pago' },
        { status: 400 }
      )
    }

    const { count: numComprobantes } = await supabase
      .from('adjuntos')
      .select('id', { count: 'exact', head: true })
      .eq('rendicion_id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)
    if (!numComprobantes || numComprobantes === 0) {
      return NextResponse.json(
        { error: 'Sube el comprobante de transferencia antes de marcar pagada.' },
        { status: 400 }
      )
    }

    const { error: errorUpdate } = await supabase
      .from('rendiciones_caja_chica')
      .update({
        estado: 'pagado',
        pagado_por: usuario.email,
        fecha_pago: ahora,
        updated_at: ahora,
      })
      .eq('id', rendicion.id)
      .eq('cliente_id', usuario.cliente_id)

    if (errorUpdate) {
      return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
