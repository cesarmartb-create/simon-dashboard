'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import FiltroMultiple from '@/components/casos/FiltroMultiple'
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

  function actualizarMultiple(key: string, valores: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    valores.forEach((v) => params.append(key, v))
    router.push(`${pathname}?${params.toString()}`)
  }

  const estadosActuales = searchParams.getAll('estado')
  const periodoActual = searchParams.get('periodo') ?? ''
  const localActual = searchParams.get('local') ?? ''

  const opcionesEstado = ESTADOS_RENDICION.map((e) => ({
    value: e,
    label: ESTADO_RENDICION_LABEL[e],
  }))

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <FiltroMultiple
        label="Estado"
        opciones={opcionesEstado}
        seleccionados={estadosActuales}
        onChange={(v) => actualizarMultiple('estado', v)}
      />

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
