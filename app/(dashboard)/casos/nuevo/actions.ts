'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual } from '@/lib/sesion'
import { notificarNuevoCaso } from '@/lib/notificar'

interface CrearCasoInput {
  categoria: string
  consulta: string
  reportadoPor: string
  colaboradorNombre: string | null
}

interface CrearCasoResult {
  ok: boolean
  casoId?: string
  error?: string
}

export async function crearCaso(
  input: CrearCasoInput
): Promise<CrearCasoResult> {
  const usuario = await getUsuarioActual()

  if (usuario.rol !== 'qf' && usuario.rol !== 'admin') {
    return { ok: false, error: 'No tienes permiso para crear solicitudes.' }
  }
  if (!usuario.cliente_id || !usuario.local) {
    return { ok: false, error: 'Tu perfil no tiene cliente o local asignados.' }
  }
  if (!input.consulta.trim()) {
    return { ok: false, error: 'La consulta no puede estar vacía.' }
  }
  if (!input.reportadoPor) {
    return { ok: false, error: 'Debes seleccionar quién reporta.' }
  }

  const supabase = createClient()

  // Resolver responsable según la categoría (fuente: areas_derivacion).
  const { data: area } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', usuario.cliente_id)
    .eq('nombre', input.categoria)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()

  const responsableCorreo = area?.responsable_correo ?? null

  const { data: caso, error } = await supabase
    .from('casos')
    .insert({
      cliente_id: usuario.cliente_id,
      local: usuario.local,
      categoria: input.categoria,
      consulta: input.consulta.trim(),
      colaborador_nombre: input.colaboradorNombre?.trim() || null,
      reportado_por: input.reportadoPor,
      responsable: responsableCorreo,
      estado: 'abierto',
      origen: 'web',
    })
    .select('id, local, categoria, consulta, colaborador_nombre, responsable')
    .single()

  if (error || !caso) {
    return {
      ok: false,
      error: `No se pudo crear el caso: ${error?.message ?? 'error desconocido'}`,
    }
  }

  // Notificar (no bloquea: notificarNuevoCaso nunca lanza).
  await notificarNuevoCaso(
    {
      id: caso.id,
      colaborador_nombre: caso.colaborador_nombre,
      local: caso.local,
      categoria: caso.categoria,
      consulta: caso.consulta,
      responsable: caso.responsable,
    },
    input.reportadoPor,
    responsableCorreo
  )

  return { ok: true, casoId: caso.id }
}
