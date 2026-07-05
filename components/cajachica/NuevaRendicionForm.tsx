'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { crearOAbrirRendicion } from '@/app/(dashboard)/caja-chica/nueva/actions'

interface Props {
  esAdmin: boolean
  localFijo: string | null
  locales: string[]
  periodoDefault: string
}

export default function NuevaRendicionForm({
  esAdmin,
  localFijo,
  locales,
  periodoDefault,
}: Props) {
  const router = useRouter()
  const [local, setLocal] = useState(localFijo ?? '')
  const [periodo, setPeriodo] = useState(periodoDefault)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const perfilIncompleto = !esAdmin && !localFijo
  if (perfilIncompleto) {
    return (
      <div className="max-w-2xl">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          Tu perfil no tiene local asignado. Contacta al administrador para
          poder crear rendiciones.
        </div>
        <div className="mt-4">
          <Link
            href="/caja-chica"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a caja chica
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (esAdmin && !local) {
      setError('Selecciona el local.')
      return
    }
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      setError('Selecciona un periodo válido.')
      return
    }

    setGuardando(true)
    const r = await crearOAbrirRendicion({ local, periodo })
    setGuardando(false)

    if (!r.ok || !r.rendicionId) {
      setError(r.error ?? 'No se pudo crear la rendición.')
      return
    }
    router.push(`/caja-chica/${r.rendicionId}`)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-6 space-y-4 max-w-2xl"
    >
      {esAdmin ? (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">Local</label>
          <select
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            <option value="" disabled>
              Selecciona el local…
            </option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          La rendición quedará asociada a tu local (<strong>{local}</strong>).
        </div>
      )}

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Periodo</label>
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          required
          className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
        <p className="text-xs text-gray-400 mt-1">
          Si ya tienes un borrador abierto en esta unidad, se abrirá ese.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/caja-chica"
          className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Abriendo…' : 'Abrir rendición'}
        </button>
      </div>
    </form>
  )
}
