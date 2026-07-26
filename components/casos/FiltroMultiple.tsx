'use client'

import { useEffect, useRef, useState } from 'react'

interface Opcion {
  value: string
  label: string
}

interface Props {
  label: string
  opciones: Opcion[]
  seleccionados: string[]
  onChange: (valores: string[]) => void
}

export default function FiltroMultiple({
  label,
  opciones,
  seleccionados,
  onChange,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function toggle(value: string) {
    if (seleccionados.includes(value)) {
      onChange(seleccionados.filter((v) => v !== value))
    } else {
      onChange([...seleccionados, value])
    }
  }

  const etiqueta =
    seleccionados.length > 0 ? `${label} (${seleccionados.length})` : label

  return (
    <div ref={ref} className="relative flex flex-col">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="w-48 px-3 py-2 border border-gray-300 text-sm bg-white text-left focus:outline-none focus:border-accent"
      >
        {etiqueta}
      </button>

      {abierto && (
        <div className="absolute top-full left-0 z-10 mt-1 w-48 bg-white border border-gray-300 shadow-lg max-h-64 overflow-y-auto">
          {opciones.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">Sin opciones</div>
          ) : (
            opciones.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="accent-accent"
                />
                {o.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
