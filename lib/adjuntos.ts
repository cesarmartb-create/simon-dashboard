import type { SupabaseClient } from '@supabase/supabase-js'

// Configuracion del bucket privado de adjuntos.
export const ADJUNTOS_BUCKET = 'adjuntos'
export const ADJUNTOS_MAX = 3
// Los comprobantes de transferencia de una rendicion pueden ser varios
// (una transferencia por empresa): limite mas alto solo para esa entidad.
export const ADJUNTOS_MAX_COMPROBANTE = 5
export const ADJUNTOS_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
export const ADJUNTOS_TIPOS_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const
export const ADJUNTOS_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export type EntidadAdjunto = 'casos' | 'ajustes' | 'gastos' | 'rendiciones'

export interface Adjunto {
  id: string
  cliente_id: string
  caso_id: string | null
  ajuste_id: string | null
  gasto_id: string | null
  rendicion_id: string | null
  nombre_archivo: string
  ruta: string
  tamano_bytes: number
  tipo_mime: string
  subido_por: string | null
  created_at: string
}

export interface AdjuntoConUrl extends Adjunto {
  url: string | null
  subido_por_nombre?: string | null
}

/** Metadato de un archivo ya subido a Storage, listo para registrarse en la tabla. */
export interface ArchivoSubido {
  nombre_archivo: string
  ruta: string
  tamano_bytes: number
  tipo_mime: string
}

export interface ResultadoSubida {
  subidos: ArchivoSubido[]
  fallidos: string[]
}

export function esImagen(tipoMime: string): boolean {
  return tipoMime === 'image/jpeg' || tipoMime === 'image/png'
}

/** Tamano legible (B, KB, MB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

/**
 * Valida un archivo en el cliente. Devuelve un mensaje de error en espanol
 * o null si el archivo es valido.
 */
export function validarArchivo(file: {
  name: string
  size: number
  type: string
}): string | null {
  if (!(ADJUNTOS_TIPOS_MIME as readonly string[]).includes(file.type)) {
    return `"${file.name}": tipo no permitido. Solo PDF, JPG o PNG.`
  }
  if (file.size === 0) {
    return `"${file.name}": el archivo esta vacio.`
  }
  if (file.size > ADJUNTOS_MAX_BYTES) {
    return `"${file.name}": supera el limite de 10 MB.`
  }
  return null
}

/** Deja el nombre sin acentos, espacios ni caracteres raros, conservando la extension. */
export function sanitizarNombre(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  const base = punto > 0 ? nombre.slice(0, punto) : nombre
  const ext = punto > 0 ? nombre.slice(punto + 1) : ''
  const limpiar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
  const baseLimpia = limpiar(base) || 'archivo'
  const extLimpia = limpiar(ext)
  return extLimpia ? `${baseLimpia}.${extLimpia}` : baseLimpia
}

function uuidCorto(): string {
  // crypto.randomUUID existe en navegadores modernos y en Node 18+.
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

/**
 * Ruta en Storage segun la convencion del proyecto:
 *   {cliente_id}/{entidad}/{entidad_id}/{uuid}-{nombre_sanitizado}
 */
export function construirRuta(
  clienteId: string,
  entidad: EntidadAdjunto,
  entidadId: string,
  nombreOriginal: string
): string {
  return `${clienteId}/${entidad}/${entidadId}/${uuidCorto()}-${sanitizarNombre(nombreOriginal)}`
}

/**
 * Sube los archivos directamente al bucket con el cliente del navegador
 * (sesion autenticada). No lanza: agrupa los que fallaron en `fallidos`
 * y devuelve el metadato de los que se subieron en `subidos`.
 */
export async function subirAdjuntos(
  supabase: SupabaseClient,
  opts: {
    clienteId: string
    entidad: EntidadAdjunto
    entidadId: string
    archivos: File[]
  }
): Promise<ResultadoSubida> {
  const subidos: ArchivoSubido[] = []
  const fallidos: string[] = []

  for (const file of opts.archivos) {
    const ruta = construirRuta(
      opts.clienteId,
      opts.entidad,
      opts.entidadId,
      file.name
    )
    const { error } = await supabase.storage
      .from(ADJUNTOS_BUCKET)
      .upload(ruta, file, { contentType: file.type, upsert: false })

    if (error) {
      fallidos.push(file.name)
      continue
    }

    subidos.push({
      nombre_archivo: file.name,
      ruta,
      tamano_bytes: file.size,
      tipo_mime: file.type,
    })
  }

  return { subidos, fallidos }
}
