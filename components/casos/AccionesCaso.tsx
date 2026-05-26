'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ESTADOS, ESTADO_LABEL, type EstadoCaso } from '@/types/caso'

interface Props {
  casoId: string
  estadoActual: EstadoCaso
  observacionesActual: string | null
}

export default function AccionesCaso({
  casoId,
  estadoActual,
  observacionesActual,
}: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoCaso>(estadoActual)
  const [observaciones, setObservaciones] = useState(observacionesActual ?? '')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    setGuardando(true)
    setMensaje(null)
    setError(null)

    const res = await fetch(`/api/casos/${casoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, observaciones, detalle }),
    })

    setGuardando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo guardar el caso.')
      return
    }

    setMensaje('Caso actualizado correctamente.')
    setDetalle('')
    router.refresh()
  }

  const cambioEstado = estado !== estadoActual
  const cambioObs = observaciones !== (observacionesActual ?? '')
  const hayCambios = cambioEstado || cambioObs

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-4">
      <div className="text-sm font-semibold text-gray-900">Acciones</div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Cambiar estado
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
          Observaciones
        </label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
          placeholder="Notas internas sobre el caso…"
        />
      </div>

      {cambioEstado && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Detalle del cambio (opcional)
          </label>
          <input
            type="text"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Por qué cambias el estado…"
            className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2">
          {mensaje}
        </div>
      )}

      <button
        onClick={handleGuardar}
        disabled={!hayCambios || guardando}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
      >
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
