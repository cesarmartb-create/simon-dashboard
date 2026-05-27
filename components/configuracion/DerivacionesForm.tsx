'use client'

import { useState } from 'react'

interface Derivacion {
  clave: string
  etiqueta: string
  descripcion: string
  responsable: string
  correo: string
}

const INICIALES: Derivacion[] = [
  {
    clave: 'operaciones',
    etiqueta: 'Operaciones',
    descripcion: 'Consultas operativas y administrativas del día a día.',
    responsable: 'María Andrea',
    correo: 'operaciones@grupobaco.cl',
  },
  {
    clave: 'cumplimiento',
    etiqueta: 'Cumplimiento',
    descripcion: 'Consultas relacionadas con normativa y cumplimiento.',
    responsable: 'Nayarhet',
    correo: 'cumplimiento@grupobaco.cl',
  },
  {
    clave: 'copia',
    etiqueta: 'Copia automática',
    descripcion: 'Dirección que recibe copia de todas las derivaciones.',
    responsable: 'César',
    correo: 'contacto@grupobaco.cl',
  },
]

export default function DerivacionesForm() {
  const [filas, setFilas] = useState<Derivacion[]>(INICIALES)
  const [guardado, setGuardado] = useState(false)

  function actualizar(clave: string, campo: 'responsable' | 'correo', valor: string) {
    setFilas((prev) =>
      prev.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f))
    )
    setGuardado(false)
  }

  function guardar() {
    // Sin backend por ahora; Supabase vendrá después.
    setGuardado(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Derivaciones</h2>
        <p className="text-sm text-gray-500">
          Define quién recibe cada tipo de consulta y a qué correo se notifica.
        </p>
      </div>

      <div className="bg-white border border-gray-200 divide-y divide-gray-100">
        {filas.map((f) => (
          <div key={f.clave} className="p-5 grid grid-cols-3 gap-4 items-start">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {f.etiqueta}
              </div>
              <div className="text-xs text-gray-500 mt-1">{f.descripcion}</div>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Responsable
              </label>
              <input
                type="text"
                value={f.responsable}
                onChange={(e) =>
                  actualizar(f.clave, 'responsable', e.target.value)
                }
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Correo
              </label>
              <input
                type="email"
                value={f.correo}
                onChange={(e) => actualizar(f.clave, 'correo', e.target.value)}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Guardar cambios
        </button>
        {guardado && (
          <span className="text-sm text-emerald-700">
            Cambios guardados (demostración, aún sin persistir).
          </span>
        )}
      </div>
    </div>
  )
}
