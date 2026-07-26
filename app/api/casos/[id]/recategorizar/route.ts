import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nombreDesdeEmail } from '@/lib/auth'
import { notificarRecategorizacion } from '@/lib/notificar'
import type { Rol, Usuario } from '@/types/usuario'
import { CATEGORIAS } from '@/types/caso'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

interface Body {
  categoria_nueva?: string
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

  if (usuario.rol === 'qf') {
    return NextResponse.json(
      { error: 'No tienes permiso para recategorizar casos' },
      { status: 403 }
    )
  }

  const body = (await request.json()) as Body
  const categoriaNueva = body.categoria_nueva
  if (!categoriaNueva || !CATEGORIAS.some((c) => c.value === categoriaNueva)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }

  // Sin gate de gestionaCasosPropios (siempre retorna false): la RLS de
  // 'casos' ya filtra visibilidad. Si el select vuelve vacio, no hay acceso.
  const { data: caso, error: errorFetch } = await supabase
    .from('casos')
    .select(
      'id, cliente_id, categoria, responsable, colaborador_nombre, local, local_correo, consulta'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (errorFetch || !caso) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const categoriaAnterior = caso.categoria as string | null

  if (
    categoriaAnterior === 'sensible' &&
    categoriaNueva !== 'sensible' &&
    usuario.rol !== 'admin'
  ) {
    return NextResponse.json(
      {
        error: 'Solo un administrador puede cambiar la categoría de un caso sensible',
      },
      { status: 403 }
    )
  }

  if (categoriaNueva === categoriaAnterior) {
    return NextResponse.json(
      { error: 'El caso ya tiene esa categoría' },
      { status: 400 }
    )
  }

  // Re-resuelve el responsable segun la nueva categoria (mismo patron que
  // app/(dashboard)/casos/nuevo/actions.ts), escopeado por el cliente_id
  // DEL CASO (no del actor).
  const { data: area } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', caso.cliente_id)
    .eq('nombre', categoriaNueva)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()

  const nuevoResponsableCorreo = area?.responsable_correo ?? null

  const { error: errorUpdate } = await supabase
    .from('casos')
    .update({
      categoria: categoriaNueva,
      responsable: nuevoResponsableCorreo,
    })
    .eq('id', params.id)

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  const ahora = new Date().toISOString()
  const { error: errorEvento } = await supabase.from('eventos').insert({
    caso_id: params.id,
    tipo: 'recategorizado',
    detalle: `Categoría: ${categoriaAnterior} → ${categoriaNueva}`,
    actor: user.email,
    fecha: ahora,
  })

  if (errorEvento) {
    console.error('[casos] Error insertando evento recategorizado:', errorEvento)
    return NextResponse.json({ error: errorEvento.message }, { status: 500 })
  }

  if (nuevoResponsableCorreo) {
    const casoCorreo = {
      id: caso.id as string,
      colaborador_nombre: caso.colaborador_nombre as string | null,
      local: caso.local as string | null,
      categoria: categoriaNueva,
      consulta: caso.consulta as string | null,
      responsable: nuevoResponsableCorreo,
      local_correo: caso.local_correo as string | null,
    }
    await notificarRecategorizacion(
      casoCorreo,
      categoriaAnterior ?? '—',
      categoriaNueva,
      user.email,
      nuevoResponsableCorreo
    )
  }

  return NextResponse.json({ ok: true })
}
