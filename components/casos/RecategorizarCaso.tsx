'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIAS } from '@/types/caso'

interface Props {
  casoId: string
  categoriaActual: string | null
  esAdmin: boolean
}

export default function RecategorizarCaso({
  casoId,
  categoriaActual,
  esAdmin,
}: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [categoria, setCategoria] = useState(categoriaActual ?? CATEGORIAS[0].value)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esSensibleActual = categoriaActual === 'sensible'
  const labelActual =
    CATEGORIAS.find((c) => c.value === categoriaActual)?.label ??
    categoriaActual ??
    '—'

  function abrir() {
    setCategoria(categoriaActual ?? CATEGORIAS[0].value)
    setError(null)
    setAbierto(true)
  }

  function cerrar() {
    if (guardando) return
    setAbierto(false)
  }

  async function handleGuardar() {
    setGuardando(true)
    setError(null)

    const res = await fetch(`/api/casos/${casoId}/recategorizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria_nueva: categoria }),
    })

    setGuardando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo cambiar la categoría.')
      return
    }

    setAbierto(false)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-3">
      <div className="text-sm font-semibold text-gray-900">Categoría</div>

      <div className="text-sm text-gray-900">{labelActual}</div>

      <button
        onClick={abrir}
        className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
      >
        Cambiar categoría
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white border border-gray-200 shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-900">
              Cambiar categoría del caso
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nueva categoría
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {CATEGORIAS.map((c) => (
                  <option
                    key={c.value}
                    value={c.value}
                    disabled={esSensibleActual && c.value !== 'sensible' && !esAdmin}
                  >
                    {c.label}
                  </option>
                ))}
              </select>
              {esSensibleActual && !esAdmin && (
                <p className="text-xs text-gray-500 mt-1">
                  Solo un administrador puede cambiar la categoría de un caso
                  sensible.
                </p>
              )}
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
                disabled={guardando || categoria === categoriaActual}
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
