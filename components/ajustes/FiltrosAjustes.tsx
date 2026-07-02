'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ESTADOS_AJUSTE, ESTADO_AJUSTE_LABEL } from '@/types/ajuste'

interface Props {
  puedeFiltrarLocal: boolean
  tipos: { id: string; nombre: string }[]
  locales: string[]
}

export default function FiltrosAjustes({
  puedeFiltrarLocal,
  tipos,
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
  const tipoActual = searchParams.get('tipo') ?? ''
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
          {ESTADOS_AJUSTE.map((e) => (
            <option key={e} value={e}>
              {ESTADO_AJUSTE_LABEL[e]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Tipo</label>
        <select
          value={tipoActual}
          onChange={(e) => actualizar('tipo', e.target.value)}
          className="w-56 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="">Todos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
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
