'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CLIENTE_ID = 'grupobaco'

interface Local {
  id: string
  codigo: string
  nombre: string
  orden: number | null
}

export default function LocalesTabla() {
  const supabase = createClient()

  const [filas, setFilas] = useState<Local[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('locales')
        .select('id, codigo, nombre, orden')
        .eq('cliente_id', CLIENTE_ID)
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar los locales: ${err.message}`)
      } else {
        setFilas((data ?? []) as Local[])
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  async function eliminar(id: string) {
    setError(null)
    const { error: err } = await supabase
      .from('locales')
      .update({ activo: false })
      .eq('id', id)

    if (err) {
      setError(`No se pudo eliminar el local: ${err.message}`)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== id))
  }

  async function agregar() {
    if (!codigo.trim() || !nombre.trim()) return
    setGuardando(true)
    setError(null)

    const maxOrden = filas.reduce((m, f) => Math.max(m, f.orden ?? 0), 0)

    const { data, error: err } = await supabase
      .from('locales')
      .insert({
        cliente_id: CLIENTE_ID,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        orden: maxOrden + 1,
        activo: true,
      })
      .select('id, codigo, nombre, orden')
      .single()

    setGuardando(false)

    if (err) {
      setError(`No se pudo agregar el local: ${err.message}`)
      return
    }

    setFilas((prev) => [...prev, data as Local])
    setCodigo('')
    setNombre('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Locales</h2>
        <p className="text-sm text-gray-500">
          {cargando
            ? 'Cargando…'
            : `${filas.length} local${filas.length === 1 ? '' : 'es'}`}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

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
          disabled={guardando || cargando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Agregar local'}
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
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Cargando locales…
                </td>
              </tr>
            ) : filas.length === 0 ? (
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
