import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarGestionCreada } from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'
import type { Gestion, TipoGestion } from '@/types/gestion'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']
const TIPOS_VALIDOS: TipoGestion[] = ['solicitud', 'memo', 'comunicado']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  tipo?: TipoGestion
  destino?: string // 'todos' o el codigo de un local puntual
  titulo?: string
  instrucciones?: string
  fecha_limite?: string
  folio_externo?: string
}

interface LocalRow {
  codigo: string
  nombre: string
  correo: string | null
}

export async function POST(request: Request) {
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

  if (usuario.rol === 'qf') {
    return NextResponse.json(
      { error: 'No tienes permiso para crear gestiones' },
      { status: 403 }
    )
  }
  if (!usuario.cliente_id) {
    return NextResponse.json(
      { error: 'Tu perfil no tiene cliente asignado' },
      { status: 401 }
    )
  }
  const clienteId = usuario.cliente_id

  const body = (await request.json()) as Body

  if (!body.tipo || !TIPOS_VALIDOS.includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  const titulo = (body.titulo ?? '').trim()
  if (!titulo) {
    return NextResponse.json(
      { error: 'El título es obligatorio' },
      { status: 400 }
    )
  }
  const instrucciones = (body.instrucciones ?? '').trim() || null
  const destino = (body.destino ?? '').trim()
  if (!destino) {
    return NextResponse.json(
      { error: 'Debes indicar el destino' },
      { status: 400 }
    )
  }
  const fechaLimite = body.fecha_limite?.trim() || null
  const folioExterno =
    body.tipo === 'comunicado' ? body.folio_externo?.trim() || null : null

  // Resuelve el/los locales destino.
  let locales: LocalRow[] = []
  const esMasivo = destino === 'todos'
  if (esMasivo) {
    const { data, error } = await supabase
      .from('locales')
      .select('codigo, nombre, correo')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    locales = (data ?? []) as LocalRow[]
    if (locales.length === 0) {
      return NextResponse.json(
        { error: 'No hay locales activos para este cliente' },
        { status: 400 }
      )
    }
  } else {
    const { data, error } = await supabase
      .from('locales')
      .select('codigo, nombre, correo')
      .eq('cliente_id', clienteId)
      .eq('codigo', destino)
      .eq('activo', true)
      .maybeSingle<LocalRow>()
    if (error || !data) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 400 })
    }
    locales = [data]
  }

  const grupoId = esMasivo ? crypto.randomUUID() : null
  const ahora = new Date().toISOString()

  const filas = locales.map((l) => ({
    cliente_id: clienteId,
    tipo: body.tipo,
    grupo_id: grupoId,
    local: `${l.codigo} — ${l.nombre}`,
    local_correo: l.correo,
    titulo,
    instrucciones,
    creado_por: usuario.email,
    estado: 'pendiente',
    fecha_limite: fechaLimite,
    folio_externo: folioExterno,
  }))

  const { data: creadas, error: errorInsert } = await supabase
    .from('gestion')
    .insert(filas)
    .select('*')

  if (errorInsert || !creadas) {
    return NextResponse.json(
      { error: errorInsert?.message ?? 'No se pudo crear la gestión' },
      { status: 500 }
    )
  }

  const filasCreadas = creadas as Gestion[]

  // Evento 'creado' + notificacion por cada fila. Best-effort: no bloquea la respuesta.
  await Promise.all(
    filasCreadas.map(async (fila) => {
      const { error: errorEvento } = await supabase.from('eventos').insert({
        gestion_id: fila.id,
        tipo: 'creado',
        detalle: null,
        actor: usuario.email,
        fecha: ahora,
      })
      if (errorEvento) {
        console.error('[gestion] Error insertando evento creado:', errorEvento)
      }
      try {
        await notificarGestionCreada(fila)
      } catch {
        // el correo es best-effort
      }
    })
  )

  return NextResponse.json({
    ok: true,
    creadas: filasCreadas.length,
    grupo_id: grupoId,
    ids: filasCreadas.map((f) => f.id),
  })
}
