'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ESTADOS_RENDICION, ESTADO_RENDICION_LABEL } from '@/types/cajachica'

interface Props {
  puedeFiltrarLocal: boolean
  locales: string[]
}

export default function FiltrosRendiciones({
  puedeFiltrarLocal,
  locales,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function actualizar(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const estadoActual = searchParams.get('estado') ?? ''
  const periodoActual = searchParams.get('periodo') ?? ''
  const localActual = searchParams.get('local') ?? ''

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Estado</label>
        <select
          value={estadoActual}
          onChange={(e) => actualizar('estado', e.target.value)}
          className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="">Todos</option>
          {ESTADOS_RENDICION.map((e) => (
            <option key={e} value={e}>
              {ESTADO_RENDICION_LABEL[e]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Periodo</label>
        <input
          type="month"
          value={periodoActual}
          onChange={(e) => actualizar('periodo', e.target.value)}
          className="w-44 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      {puedeFiltrarLocal && (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">Local</label>
          <select
            value={localActual}
            onChange={(e) => actualizar('local', e.target.value)}
            className="w-56 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
