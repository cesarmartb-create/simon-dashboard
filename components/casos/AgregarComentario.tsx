'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  casoId: string
}

export default function AgregarComentario({ casoId }: Props) {
  const router = useRouter()
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    if (!comentario.trim()) return
    setGuardando(true)
    setError(null)

    const res = await fetch(`/api/casos/${casoId}/comentario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentario: comentario.trim() }),
    })

    setGuardando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo agregar el comentario.')
      return
    }

    setComentario('')
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 p-5 space-y-3">
      <div className="text-sm font-semibold text-gray-900">
        Agregar comentario
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        placeholder="Escribe un comentario…"
        className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
      />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={guardando || !comentario.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Agregar comentario'}
        </button>
      </div>
    </div>
  )
}
