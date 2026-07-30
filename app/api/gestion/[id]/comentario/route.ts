import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarComentarioGestion } from '@/lib/notificar'
import type { Rol } from '@/types/usuario'
import type { Gestion } from '@/types/gestion'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  comentario?: string
}

export async function POST(
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

  const body = (await request.json()) as Body
  const comentario = (body.comentario ?? '').trim()
  if (!comentario) {
    return NextResponse.json(
      { error: 'El comentario no puede estar vacío' },
      { status: 400 }
    )
  }

  // Sin gate adicional de rol: la RLS de 'gestion' ya filtra visibilidad.
  // Si el select vuelve vacio, no hay acceso.
  const { data: fila, error: errorFetch } = await supabase
    .from('gestion')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Gestion>()

  if (errorFetch || !fila) {
    return NextResponse.json({ error: 'Gestión no encontrada' }, { status: 404 })
  }

  const ahora = new Date().toISOString()

  const { error: errorEvento } = await supabase.from('eventos').insert({
    gestion_id: params.id,
    tipo: 'comentario',
    detalle: comentario,
    actor: user.email,
    fecha: ahora,
  })

  if (errorEvento) {
    console.error('[gestion] Error insertando evento comentario:', errorEvento)
    return NextResponse.json({ error: errorEvento.message }, { status: 500 })
  }

  // Notifica a ambos interesados (local y quien creo la gestion), excepto a
  // quien escribio el comentario.
  const candidatos = [fila.local_correo, fila.creado_por]
  const destinatarios = Array.from(
    new Set(
      candidatos.filter(
        (email): email is string => !!email && email !== user.email
      )
    )
  )

  if (destinatarios.length > 0) {
    await notificarComentarioGestion(fila, comentario, user.email, destinatarios)
  }

  return NextResponse.json({ ok: true })
}
