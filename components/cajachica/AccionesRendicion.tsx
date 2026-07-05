'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EstadoRendicion } from '@/types/cajachica'

interface Props {
  rendicionId: string
  estado: EstadoRendicion
  puedeEnviar: boolean
  gestiona: boolean
}

export default function AccionesRendicion({
  rendicionId,
  estado,
  puedeEnviar,
  gestiona,
}: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [observacion, setObservacion] = useState('')

  async function patch(body: Record<string, unknown>) {
    setError(null)
    setGuardando(true)
    const res = await fetch(`/api/caja-chica/${rendicionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setGuardando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo completar la acción.')
      return
    }
    router.refresh()
  }

  const puedeCerrar = gestiona && estado === 'en_revision'
  const puedePagar =
    gestiona && (estado === 'aprobada' || estado === 'aprobada_parcial')
  const puedeEnviarAhora = puedeEnviar && estado === 'abierto'

  if (!puedeEnviarAhora && !puedeCerrar && !puedePagar) return null

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-3">
      <div className="text-sm font-semibold text-gray-900">Acciones</div>

      {puedeEnviarAhora && (
        <button
          onClick={() => patch({ accion: 'enviar' })}
          disabled={guardando}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
        >
          {guardando ? 'Enviando…' : 'Enviar a revisión'}
        </button>
      )}

      {puedeCerrar && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Observación de cierre (opcional)
          </label>
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={2}
            placeholder="Nota de la revisión…"
            className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
          />
          <button
            onClick={() =>
              patch({
                accion: 'cerrar',
                observacion_cierre: observacion.trim() || undefined,
              })
            }
            disabled={guardando}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
          >
            {guardando ? 'Cerrando…' : 'Cerrar revisión'}
          </button>
          <p className="text-xs text-gray-400">
            Todos los gastos deben estar aprobados o rechazados.
          </p>
        </div>
      )}

      {puedePagar && (
        <button
          onClick={() => patch({ accion: 'pagar' })}
          disabled={guardando}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
        >
          {guardando ? 'Procesando…' : 'Marcar pagada'}
        </button>
      )}
      {puedePagar && (
        <p className="text-xs text-gray-400">
          Debes subir el comprobante de transferencia antes de marcar pagada.
        </p>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
