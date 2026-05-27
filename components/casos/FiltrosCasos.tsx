'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ESTADOS, ESTADO_LABEL } from '@/types/caso'
import { nombresQueGestionanCasos, puedeVerVistaGlobal } from '@/lib/auth'
import type { Rol } from '@/types/usuario'

interface Props {
  rol: Rol
  categorias: string[]
}

export default function FiltrosCasos({ rol, categorias }: Props) {
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
  const responsableActual = searchParams.get('responsable') ?? ''
  const categoriaActual = searchParams.get('categoria') ?? ''
  const busquedaActual = searchParams.get('q') ?? ''

  const gestores = nombresQueGestionanCasos()

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Buscar</label>
        <input
          type="text"
          defaultValue={busquedaActual}
          onBlur={(e) => actualizar('q', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') actualizar('q', e.currentTarget.value)
          }}
          placeholder="Colaborador, consulta…"
          className="w-64 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Estado</label>
        <select
          value={estadoActual}
          onChange={(e) => actualizar('estado', e.target.value)}
          className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </select>
      </div>

      {puedeVerVistaGlobal(rol) && (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Responsable
          </label>
          <select
            value={responsableActual}
            onChange={(e) => actualizar('responsable', e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {gestores.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Categoría
        </label>
        <select
          value={categoriaActual}
          onChange={(e) => actualizar('categoria', e.target.value)}
          className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
