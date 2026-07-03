'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioActual } from '@/lib/sesion'
import { esAdmin } from '@/lib/auth'
import { puedeVerAjustes, AREA_AJUSTES } from '@/lib/ajustes'
import { notificarNuevoCaso, notificarNuevoAjuste } from '@/lib/notificar'
import {
  ADJUNTOS_BUCKET,
  ADJUNTOS_MAX,
  ADJUNTOS_MAX_BYTES,
  ADJUNTOS_TIPOS_MIME,
  type ArchivoSubido,
  type EntidadAdjunto,
} from '@/lib/adjuntos'
import type { AjusteInventario } from '@/types/ajuste'

interface RegistrarInput {
  entidad: EntidadAdjunto
  entidadId: string
  archivos: ArchivoSubido[]
}

interface RegistrarResult {
  ok: boolean
  registrados?: number
  error?: string
}

/**
 * Registra en la tabla `adjuntos` las filas de archivos ya subidos a Storage.
 * Revalida tipo, tamano, cantidad y ruta en el servidor, y aplica el mismo
 * control de acceso que las paginas de detalle (cliente + local para qf).
 */
export async function registrarAdjuntos(
  input: RegistrarInput
): Promise<RegistrarResult> {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const archivos = input.archivos ?? []
  if (archivos.length === 0) return { ok: true, registrados: 0 }
  if (archivos.length > ADJUNTOS_MAX) {
    return {
      ok: false,
      error: `Solo puedes adjuntar hasta ${ADJUNTOS_MAX} archivos.`,
    }
  }

  for (const a of archivos) {
    if (!(ADJUNTOS_TIPOS_MIME as readonly string[]).includes(a.tipo_mime)) {
      return { ok: false, error: `"${a.nombre_archivo}": tipo no permitido.` }
    }
    if (
      typeof a.tamano_bytes !== 'number' ||
      a.tamano_bytes <= 0 ||
      a.tamano_bytes > ADJUNTOS_MAX_BYTES
    ) {
      return {
        ok: false,
        error: `"${a.nombre_archivo}": tamano invalido (maximo 10 MB).`,
      }
    }
  }

  const clienteUsuario = usuario.cliente_id
  if (!clienteUsuario) {
    return { ok: false, error: 'Tu perfil no tiene cliente asignado.' }
  }

  // Control de acceso al registro y cliente_id efectivo.
  let clienteId = clienteUsuario
  if (input.entidad === 'casos') {
    const { data: caso } = await supabase
      .from('casos')
      .select('id, cliente_id, local')
      .eq('id', input.entidadId)
      .maybeSingle<{ id: string; cliente_id: string; local: string | null }>()
    if (!caso || caso.cliente_id !== clienteUsuario) {
      return { ok: false, error: 'No tienes acceso a este caso.' }
    }
    if (usuario.rol === 'qf' && caso.local !== (usuario.local ?? '')) {
      return { ok: false, error: 'No tienes acceso a este caso.' }
    }
    clienteId = caso.cliente_id
  } else {
    if (!puedeVerAjustes(usuario)) {
      return { ok: false, error: 'No tienes acceso a este ajuste.' }
    }
    const { data: ajuste } = await supabase
      .from('ajustes_inventario')
      .select('id, cliente_id, local')
      .eq('id', input.entidadId)
      .maybeSingle<{ id: string; cliente_id: string; local: string }>()
    if (!ajuste || ajuste.cliente_id !== clienteUsuario) {
      return { ok: false, error: 'No tienes acceso a este ajuste.' }
    }
    if (usuario.rol === 'qf' && ajuste.local !== (usuario.local ?? '')) {
      return { ok: false, error: 'No tienes acceso a este ajuste.' }
    }
    clienteId = ajuste.cliente_id
  }

  // La ruta debe pertenecer a este registro (evita inyeccion de rutas).
  const prefijo = `${clienteId}/${input.entidad}/${input.entidadId}/`
  for (const a of archivos) {
    if (!a.ruta.startsWith(prefijo)) {
      return { ok: false, error: 'Ruta de archivo invalida.' }
    }
  }

  const filas = archivos.map((a) => ({
    cliente_id: clienteId,
    caso_id: input.entidad === 'casos' ? input.entidadId : null,
    ajuste_id: input.entidad === 'ajustes' ? input.entidadId : null,
    nombre_archivo: a.nombre_archivo,
    ruta: a.ruta,
    tamano_bytes: a.tamano_bytes,
    tipo_mime: a.tipo_mime,
    subido_por: usuario.email,
  }))

  const { error } = await supabase.from('adjuntos').insert(filas)
  if (error) {
    return {
      ok: false,
      error: `No se pudieron registrar los adjuntos: ${error.message}`,
    }
  }

  return { ok: true, registrados: filas.length }
}

/** Elimina un adjunto (objeto de Storage + fila). Solo admin, con confirmacion en la UI. */
export async function eliminarAdjunto(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const usuario = await getUsuarioActual()
  if (!esAdmin(usuario.rol)) {
    return { ok: false, error: 'Solo un administrador puede eliminar adjuntos.' }
  }

  const supabase = createClient()

  const { data: adjunto } = await supabase
    .from('adjuntos')
    .select('id, ruta')
    .eq('id', id)
    .maybeSingle<{ id: string; ruta: string }>()
  if (!adjunto) return { ok: false, error: 'Adjunto no encontrado.' }

  // Primero el objeto de Storage; si falla, no dejamos la fila huerfana al reves.
  const { error: errStorage } = await supabase.storage
    .from(ADJUNTOS_BUCKET)
    .remove([adjunto.ruta])
  if (errStorage) {
    return { ok: false, error: `No se pudo borrar el archivo: ${errStorage.message}` }
  }

  const { error: errFila } = await supabase.from('adjuntos').delete().eq('id', id)
  if (errFila) {
    return { ok: false, error: `No se pudo borrar el registro: ${errFila.message}` }
  }

  return { ok: true }
}

async function contarAdjuntos(
  supabase: ReturnType<typeof createClient>,
  columna: 'caso_id' | 'ajuste_id',
  id: string
): Promise<number> {
  const { count } = await supabase
    .from('adjuntos')
    .select('id', { count: 'exact', head: true })
    .eq(columna, id)
  return count ?? 0
}

/**
 * Envia el correo de "solicitud nueva" tras crear el caso, incluyendo el
 * conteo real de adjuntos. Se llama SIEMPRE despues de crear (aunque haya 0
 * adjuntos), de modo que el correo salga como hoy. Nunca lanza.
 */
export async function notificarCasoCreado(casoId: string): Promise<void> {
  const supabase = createClient()

  const { data: caso } = await supabase
    .from('casos')
    .select(
      'id, colaborador_nombre, local, categoria, consulta, responsable, reportado_por'
    )
    .eq('id', casoId)
    .maybeSingle<{
      id: string
      colaborador_nombre: string | null
      local: string | null
      categoria: string | null
      consulta: string | null
      responsable: string | null
      reportado_por: string | null
    }>()
  if (!caso) return

  const numAdjuntos = await contarAdjuntos(supabase, 'caso_id', casoId)

  await notificarNuevoCaso(
    {
      id: caso.id,
      colaborador_nombre: caso.colaborador_nombre,
      local: caso.local,
      categoria: caso.categoria,
      consulta: caso.consulta,
      responsable: caso.responsable,
    },
    caso.reportado_por,
    caso.responsable,
    numAdjuntos
  )
}

type AjusteConTipo = AjusteInventario & {
  tipos_ajuste: { nombre: string } | null
}

/**
 * Envia el correo de "nuevo ajuste" tras crear el ajuste, incluyendo el
 * conteo real de adjuntos. Se llama SIEMPRE despues de crear. Nunca lanza.
 */
export async function notificarAjusteCreado(ajusteId: string): Promise<void> {
  const supabase = createClient()

  const { data: ajuste } = await supabase
    .from('ajustes_inventario')
    .select('*, tipos_ajuste(nombre)')
    .eq('id', ajusteId)
    .maybeSingle<AjusteConTipo>()
  if (!ajuste) return

  const numAdjuntos = await contarAdjuntos(supabase, 'ajuste_id', ajusteId)

  // Responsable del area al momento de enviar (la tabla de ajustes no lo guarda).
  const { data: area } = await supabase
    .from('areas_derivacion')
    .select('responsable_correo')
    .eq('cliente_id', ajuste.cliente_id)
    .eq('nombre', AREA_AJUSTES)
    .eq('activo', true)
    .maybeSingle<{ responsable_correo: string | null }>()

  await notificarNuevoAjuste(
    {
      id: ajuste.id,
      local: ajuste.local,
      tipoNombre: ajuste.tipos_ajuste?.nombre ?? '—',
      direccion: ajuste.direccion,
      cantidadSku: ajuste.cantidad_sku,
      monto: ajuste.monto,
      folioOrigen: ajuste.folio_origen,
      folioReferencia: ajuste.folio_referencia,
      observacion: ajuste.observacion,
      reportadoPor: ajuste.reportado_por,
    },
    area?.responsable_correo ?? null,
    numAdjuntos
  )
}
