import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nombreDesdeEmail } from '@/lib/auth'
import { notificarComentarioCaso } from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'

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

  const usuario: Usuario = {
    email: user.email.toLowerCase(),
    nombre: nombreDesdeEmail(user.email),
    rol: perfil.rol as Rol,
    cliente_id: perfil.cliente_id,
    local: perfil.local,
    areas: perfil.areas,
  }

  const body = (await request.json()) as Body
  const comentario = (body.comentario ?? '').trim()
  if (!comentario) {
    return NextResponse.json(
      { error: 'El comentario no puede estar vacío' },
      { status: 400 }
    )
  }

  // Sin gate de gestionaCasosPropios (siempre retorna false): la RLS de
  // 'casos' ya filtra visibilidad. Si el select vuelve vacio, no hay acceso.
  const { data: caso, error: errorFetch } = await supabase
    .from('casos')
    .select(
      'id, responsable, local_correo, colaborador_nombre, local, categoria, consulta'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (errorFetch || !caso) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const ahora = new Date().toISOString()

  const { error: errorEvento } = await supabase.from('eventos').insert({
    caso_id: params.id,
    tipo: 'comentario',
    detalle: comentario,
    actor: user.email,
    fecha: ahora,
  })

  if (errorEvento) {
    console.error('[casos] Error insertando evento comentario:', errorEvento)
    return NextResponse.json({ error: errorEvento.message }, { status: 500 })
  }

  // Notifica a ambos interesados del caso (local y responsable), excepto a
  // quien escribio el comentario.
  const candidatos = [caso.local_correo, caso.responsable]
  const destinatarios = Array.from(
    new Set(
      candidatos.filter(
        (email): email is string => !!email && email !== user.email
      )
    )
  )

  if (destinatarios.length > 0) {
    const casoCorreo = {
      id: caso.id as string,
      colaborador_nombre: caso.colaborador_nombre as string | null,
      local: caso.local as string | null,
      categoria: caso.categoria as string | null,
      consulta: caso.consulta as string | null,
      responsable: caso.responsable as string | null,
      local_correo: caso.local_correo as string | null,
    }
    await notificarComentarioCaso(casoCorreo, comentario, user.email, destinatarios)
  }

  return NextResponse.json({ ok: true })
}
