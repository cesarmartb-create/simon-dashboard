'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import FiltroMultiple from '@/components/casos/FiltroMultiple'
import { ESTADOS, ESTADO_LABEL } from '@/types/caso'
import { puedeVerVistaGlobal } from '@/lib/auth'
import type { Rol } from '@/types/usuario'

interface Props {
  rol: Rol
  categorias: string[]
  responsables: { value: string; label: string }[]
}

export default function FiltrosCasos({ rol, categorias, responsables }: Props) {
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
  const responsablesActuales = searchParams.getAll('responsable')
  const categoriasActuales = searchParams.getAll('categoria')
  const busquedaActual = searchParams.get('q') ?? ''

  const opcionesEstado = ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e] }))
  const opcionesCategoria = categorias.map((c) => ({ value: c, label: c }))

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

      <FiltroMultiple
        label="Estado"
        opciones={opcionesEstado}
        seleccionados={estadosActuales}
        onChange={(v) => actualizarMultiple('estado', v)}
      />

      {puedeVerVistaGlobal(rol) && (
        <FiltroMultiple
          label="Responsable"
          opciones={responsables}
          seleccionados={responsablesActuales}
          onChange={(v) => actualizarMultiple('responsable', v)}
        />
      )}

      <FiltroMultiple
        label="Categoría"
        opciones={opcionesCategoria}
        seleccionados={categoriasActuales}
        onChange={(v) => actualizarMultiple('categoria', v)}
      />
    </div>
  )
}
