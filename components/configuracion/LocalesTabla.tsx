'use client'

import { useState } from 'react'

interface Local {
  id: string
  codigo: string
  nombre: string
}

const INICIALES: Local[] = [
  { id: '1', codigo: 'CM', nombre: 'Casa Matriz' },
  { id: '2', codigo: 'L01', nombre: 'Local Centro' },
  { id: '3', codigo: 'L02', nombre: 'Local Norte' },
]

export default function LocalesTabla() {
  const [filas, setFilas] = useState<Local[]>(INICIALES)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')

  function eliminar(id: string) {
    setFilas((prev) => prev.filter((f) => f.id !== id))
  }

  function agregar() {
    if (!codigo.trim() || !nombre.trim()) return
    setFilas((prev) => [
      ...prev,
      { id: crypto.randomUUID(), codigo: codigo.trim(), nombre: nombre.trim() },
    ])
    setCodigo('')
    setNombre('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Locales</h2>
        <p className="text-sm text-gray-500">
          {filas.length} local{filas.length === 1 ? '' : 'es'}
        </p>
      </div>

      <div className="bg-white border border-gray-200 p-4 flex items-end gap-3">
        <div className="flex flex-col w-32">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Código
          </label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col flex-1">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={agregar}
          className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Agregar local
        </button>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium w-16">#</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium w-20 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No hay locales.
                </td>
              </tr>
            ) : (
              filas.map((f, i) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {f.codigo}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{f.nombre}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => eliminar(f.id)}
                      className="text-red-600 text-xs font-medium hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
