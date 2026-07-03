'use client'

import { useRef, useState } from 'react'
import {
  ADJUNTOS_ACCEPT,
  ADJUNTOS_MAX,
  formatBytes,
  validarArchivo,
} from '@/lib/adjuntos'

interface Props {
  archivos: File[]
  onChange: (archivos: File[]) => void
  disabled?: boolean
}

/**
 * Selector de archivos con validacion en cliente (tipo, tamano, cantidad).
 * El estado de archivos lo controla el padre; este componente solo valida
 * y notifica. La subida a Storage la orquesta quien lo usa.
 */
export default function AdjuntosInput({ archivos, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [errores, setErrores] = useState<string[]>([])

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? [])
    // Permite volver a elegir el mismo archivo tras quitarlo.
    if (inputRef.current) inputRef.current.value = ''
    if (nuevos.length === 0) return

    const errs: string[] = []
    const aceptados: File[] = [...archivos]

    for (const file of nuevos) {
      const err = validarArchivo(file)
      if (err) {
        errs.push(err)
        continue
      }
      const duplicado = aceptados.some(
        (f) => f.name === file.name && f.size === file.size
      )
      if (duplicado) continue
      if (aceptados.length >= ADJUNTOS_MAX) {
        errs.push(
          `Maximo ${ADJUNTOS_MAX} archivos. "${file.name}" no se agrego.`
        )
        continue
      }
      aceptados.push(file)
    }

    setErrores(errs)
    onChange(aceptados)
  }

  function quitar(idx: number) {
    onChange(archivos.filter((_, i) => i !== idx))
    setErrores([])
  }

  const topeAlcanzado = archivos.length >= ADJUNTOS_MAX

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-700">
        Adjuntos (opcional)
      </label>
      <p className="text-xs text-gray-500">
        PDF, JPG o PNG. Maximo {ADJUNTOS_MAX} archivos, 10 MB cada uno.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ADJUNTOS_ACCEPT}
        disabled={disabled || topeAlcanzado}
        onChange={handleSelect}
        className="block w-full text-sm text-gray-700 file:mr-3 file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50"
      />

      {archivos.length > 0 && (
        <ul className="flex flex-col gap-1">
          {archivos.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="truncate text-gray-700">
                {f.name}{' '}
                <span className="text-gray-400">({formatBytes(f.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                disabled={disabled}
                className="ml-3 shrink-0 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {errores.length > 0 && (
        <ul className="text-xs text-red-700 space-y-0.5">
          {errores.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
