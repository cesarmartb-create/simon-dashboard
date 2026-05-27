'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ESTADOS, ESTADO_LABEL, type EstadoCaso } from '@/types/caso'

interface Props {
  casoId: string
  estadoActual: EstadoCaso
}

export default function AccionesCaso({ casoId, estadoActual }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<EstadoCaso>(estadoActual)
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function abrir() {
    setEstado(estadoActual)
    setObservacion('')
    setError(null)
    setAbierto(true)
  }

  function cerrar() {
    if (guardando) return
    setAbierto(false)
  }

  async function handleGuardar() {
    if (!observacion.trim()) return
    setGuardando(true)
    setError(null)

    const body: Record<string, unknown> = {
      estado,
      observacion: observacion.trim(),
      estado_anterior: estadoActual,
    }
    if (estado === 'esperando_empleado') body.notificar_colaborador = true
    if (estado === 'escalado') body.notificar_escalado = true

    const res = await fetch(`/api/casos/${casoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setGuardando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo guardar el cambio.')
      return
    }

    setAbierto(false)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-4">
      <div className="text-sm font-semibold text-gray-900">Acciones</div>

      <div>
        <div className="text-xs text-gray-500 mb-1">Estado actual</div>
        <div className="text-sm font-medium text-gray-900">
          {ESTADO_LABEL[estadoActual] ?? estadoActual}
        </div>
      </div>

      <button
        onClick={abrir}
        className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
      >
        Cambiar estado
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white border border-gray-200 shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-900">
              Cambiar estado del caso
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nuevo estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoCaso)}
                className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Observación
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={4}
                placeholder="Describe el motivo del cambio…"
                className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={cerrar}
                disabled={guardando}
                className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando || !observacion.trim()}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
