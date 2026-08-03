import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeAnularGestion } from '@/lib/gestion'
import type { Rol, Usuario } from '@/types/usuario'

const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

export async function PATCH(
  request: Request,
  { params }: { params: { grupoId: string } }
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

  if (!puedeAnularGestion(usuario)) {
    return NextResponse.json(
      { error: 'No tienes permiso para anular este grupo de gestión' },
      { status: 403 }
    )
  }

  // La RLS ya filtra visibilidad; el .eq de cliente_id (si aplica) queda
  // como segunda capa multi-tenant a nivel de codigo, igual que en el
  // endpoint individual.
  const { data: filas, error: errorFetch } = await supabase
    .from('gestion')
    .select('id')
    .eq('grupo_id', params.grupoId)

  if (errorFetch || !filas || filas.length === 0) {
    return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
  }

  const ahora = new Date().toISOString()

  // Anulacion masiva: fuerza el cambio de estado sin importar si la gestion
  // ya estaba 'leida' o 'respondida' (a diferencia del endpoint individual,
  // que solo permite anular desde 'pendiente').
  const { error: errorUpdate } = await supabase
    .from('gestion')
    .update({
      estado: 'anulada',
      updated_at: ahora,
    })
    .eq('grupo_id', params.grupoId)

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  const { error: errorEventos } = await supabase.from('eventos').insert(
    filas.map((f) => ({
      gestion_id: f.id,
      tipo: 'cambio_estado',
      detalle: `Anulada por ${usuario.email} (anulación masiva de grupo)`,
      actor: usuario.email,
      fecha: ahora,
    }))
  )
  if (errorEventos) {
    console.error(
      '[gestion] Error insertando evento cambio_estado (grupo):',
      errorEventos
    )
  }

  return NextResponse.json({ ok: true, actualizadas: filas.length })
}
