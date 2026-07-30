'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdjuntosInput from '@/components/adjuntos/AdjuntosInput'
import { registrarAdjuntos } from '@/components/adjuntos/actions'
import { subirAdjuntos } from '@/lib/adjuntos'
import { puedeResponderGestion, puedeAnularGestion } from '@/lib/gestion'
import type { Gestion } from '@/types/gestion'
import type { Usuario } from '@/types/usuario'

interface Props {
  fila: Gestion
  usuario: Usuario
}

export default function ResponderGestion({ fila, usuario }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarAnular, setConfirmarAnular] = useState(false)

  const puedeResponder = puedeResponderGestion(usuario, fila)
  const puedeAnular = puedeAnularGestion(usuario)

  if (fila.estado !== 'pendiente') return null

  async function ejecutarAccion(accion: 'responder' | 'marcar_leida' | 'anular') {
    setGuardando(true)
    setError(null)

    if (accion === 'responder') {
      const exigeAdjunto =
        fila.tipo === 'solicitud' ||
        (fila.tipo === 'solicitud_simple' && fila.requiere_adjunto === true)

      if (exigeAdjunto && archivos.length === 0) {
        setGuardando(false)
        setError('Debes adjuntar el documento antes de responder.')
        return
      }
      const { subidos, fallidos } = await subirAdjuntos(supabase, {
        clienteId: fila.cliente_id,
        entidad: 'gestion',
        entidadId: fila.id,
        archivos,
      })
      if (subidos.length > 0) {
        const reg = await registrarAdjuntos({
          entidad: 'gestion',
          entidadId: fila.id,
          archivos: subidos,
        })
        if (!reg.ok) {
          setGuardando(false)
          setError(reg.error ?? 'No se pudo registrar el adjunto.')
          return
        }
      }
      if (fallidos.length > 0) {
        setGuardando(false)
        setError(`No se pudo subir: ${fallidos.join(', ')}.`)
        return
      }
    }

    const res = await fetch(`/api/gestion/${fila.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    })

    setGuardando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo completar la acción.')
      return
    }

    setConfirmarAnular(false)
    router.refresh()
  }

  if (!puedeResponder && !puedeAnular) return null

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-4">
      <div className="text-sm font-semibold text-gray-900">Acciones</div>

      {puedeResponder &&
        (fila.tipo === 'solicitud' ||
          (fila.tipo === 'solicitud_simple' && fila.requiere_adjunto === true)) && (
        <div className="space-y-3">
          <AdjuntosInput
            archivos={archivos}
            onChange={setArchivos}
            disabled={guardando}
            label="Documento de respuesta"
          />
          <button
            onClick={() => ejecutarAccion('responder')}
            disabled={guardando || archivos.length === 0}
            className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {guardando ? 'Guardando…' : 'Responder'}
          </button>
        </div>
      )}

      {puedeResponder && (fila.tipo === 'memo' || fila.tipo === 'comunicado') && (
        <button
          onClick={() => ejecutarAccion('marcar_leida')}
          disabled={guardando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Marcar como leído'}
        </button>
      )}

      {puedeResponder && fila.tipo === 'solicitud_simple' && fila.requiere_adjunto === false && (
        <button
          onClick={() => ejecutarAccion('responder')}
          disabled={guardando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Acuse de recibo'}
        </button>
      )}

      {puedeAnular && (
        <div className="pt-3 border-t border-gray-100">
          {confirmarAnular ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">¿Anular esta gestión?</span>
              <button
                onClick={() => ejecutarAccion('anular')}
                disabled={guardando}
                className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
              >
                {guardando ? 'Anulando…' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmarAnular(false)}
                disabled={guardando}
                className="text-xs text-gray-500 hover:underline disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmarAnular(true)}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Anular
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
