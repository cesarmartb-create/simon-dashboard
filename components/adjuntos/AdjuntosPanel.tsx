'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdjuntosInput from './AdjuntosInput'
import { registrarAdjuntos, eliminarAdjunto } from './actions'
import {
  esImagen,
  formatBytes,
  subirAdjuntos,
  type AdjuntoConUrl,
  type EntidadAdjunto,
} from '@/lib/adjuntos'
import { formatFecha } from '@/lib/utils'

interface Props {
  entidad: EntidadAdjunto
  entidadId: string
  clienteId: string
  adjuntos: AdjuntoConUrl[]
  esAdmin: boolean
}

/**
 * Modo detalle: lista los adjuntos existentes y permite agregar mas.
 * Quien puede ver el caso/ajuste puede agregar; eliminar es solo admin.
 * Tras cambios refresca la ruta para regenerar las URLs firmadas server-side.
 */
export default function AdjuntosPanel({
  entidad,
  entidadId,
  clienteId,
  adjuntos,
  esAdmin,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [nuevos, setNuevos] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  async function handleSubir() {
    if (nuevos.length === 0) return
    setSubiendo(true)
    setError(null)
    setAviso(null)

    const { subidos, fallidos } = await subirAdjuntos(supabase, {
      clienteId,
      entidad,
      entidadId,
      archivos: nuevos,
    })

    if (subidos.length > 0) {
      const res = await registrarAdjuntos({ entidad, entidadId, archivos: subidos })
      if (!res.ok) {
        setSubiendo(false)
        setError(res.error ?? 'No se pudieron registrar los adjuntos.')
        return
      }
    }

    setSubiendo(false)
    setNuevos([])

    if (fallidos.length > 0) {
      setAviso(`No se pudieron subir: ${fallidos.join(', ')}.`)
    }
    router.refresh()
  }

  async function handleEliminar(id: string) {
    setBorrando(id)
    setError(null)
    const res = await eliminarAdjunto(id)
    setBorrando(null)
    setConfirmar(null)
    if (!res.ok) {
      setError(res.error ?? 'No se pudo eliminar el adjunto.')
      return
    }
    router.refresh()
  }

  return (
    <section className="bg-white border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Adjuntos{adjuntos.length > 0 ? ` (${adjuntos.length})` : ''}
      </h3>

      {adjuntos.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No hay archivos adjuntos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 mb-4">
          {adjuntos.map((a) => (
            <li
              key={a.id}
              className="border border-gray-200 p-3 flex flex-col gap-2"
            >
              {esImagen(a.tipo_mime) && a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.nombre_archivo}
                    className="w-full h-32 object-cover border border-gray-100"
                  />
                </a>
              ) : (
                <a
                  href={a.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <span className="text-2xl leading-none">📄</span>
                  <span className="truncate">{a.nombre_archivo}</span>
                </a>
              )}

              <div className="text-xs text-gray-500 space-y-0.5">
                <div className="truncate text-gray-700">{a.nombre_archivo}</div>
                <div>{formatBytes(a.tamano_bytes)}</div>
                <div>{a.subido_por_nombre ?? a.subido_por ?? '—'}</div>
                <div>{formatFecha(a.created_at)}</div>
              </div>

              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline self-start"
                >
                  Ver / descargar
                </a>
              )}

              {esAdmin &&
                (confirmar === a.id ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEliminar(a.id)}
                      disabled={borrando === a.id}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                    >
                      {borrando === a.id ? 'Eliminando…' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setConfirmar(null)}
                      disabled={borrando === a.id}
                      className="text-xs text-gray-500 hover:underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmar(a.id)}
                    className="text-xs text-red-600 hover:text-red-700 self-start"
                  >
                    Eliminar
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <AdjuntosInput archivos={nuevos} onChange={setNuevos} disabled={subiendo} />
        {nuevos.length > 0 && (
          <button
            onClick={handleSubir}
            disabled={subiendo}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {subiendo ? 'Subiendo…' : `Subir ${nuevos.length} archivo(s)`}
          </button>
        )}
        {aviso && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
            {aviso}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
