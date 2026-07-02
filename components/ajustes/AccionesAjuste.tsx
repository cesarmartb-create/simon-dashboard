'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ajusteId: string
  montoActual: number | null
}

type Modo = null | 'realizado' | 'anulado'

export default function AccionesAjuste({ ajusteId, montoActual }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>(null)
  const [folio, setFolio] = useState('')
  const [monto, setMonto] = useState(
    montoActual === null ? '' : String(montoActual)
  )
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function abrir(nuevoModo: Exclude<Modo, null>) {
    setFolio('')
    setMonto(montoActual === null ? '' : String(montoActual))
    setObservacion('')
    setError(null)
    setModo(nuevoModo)
  }

  function cerrar() {
    if (guardando) return
    setModo(null)
  }

  async function handleGuardar() {
    setError(null)

    const body: Record<string, unknown> = { accion: modo }

    if (modo === 'realizado') {
      if (!folio.trim()) return
      body.folio_ajuste = folio.trim()
      if (monto.trim() !== '') {
        const montoNum = Number(monto)
        if (isNaN(montoNum) || montoNum < 0) {
          setError('El monto debe ser un número positivo.')
          return
        }
        body.monto = montoNum
      } else {
        body.monto = null
      }
      if (observacion.trim()) body.observacion_cierre = observacion.trim()
    } else {
      if (!observacion.trim()) return
      body.observacion_cierre = observacion.trim()
    }

    setGuardando(true)

    const res = await fetch(`/api/ajustes/${ajusteId}`, {
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

    setModo(null)
    router.refresh()
  }

  const puedeGuardar =
    modo === 'realizado' ? !!folio.trim() : !!observacion.trim()

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-3">
      <div className="text-sm font-semibold text-gray-900">Acciones</div>

      <button
        onClick={() => abrir('realizado')}
        className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
      >
        Marcar realizado
      </button>

      <button
        onClick={() => abrir('anulado')}
        className="w-full border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium py-2 transition-colors"
      >
        Anular
      </button>

      {modo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white border border-gray-200 shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-900">
              {modo === 'realizado' ? 'Marcar como realizado' : 'Anular ajuste'}
            </div>

            {modo === 'realizado' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Folio del ajuste
                  </label>
                  <input
                    type="text"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="Folio con que quedó registrado"
                    className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Monto final (opcional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="Completa o corrige el monto"
                    className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {modo === 'realizado'
                  ? 'Observación de cierre (opcional)'
                  : 'Observación (obligatoria)'}
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                placeholder={
                  modo === 'realizado'
                    ? 'Notas del cierre…'
                    : 'Motivo de la anulación…'
                }
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
                disabled={guardando || !puedeGuardar}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {guardando
                  ? 'Guardando…'
                  : modo === 'realizado'
                    ? 'Confirmar realizado'
                    : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
