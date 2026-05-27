'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from './ConfirmDialog'

const CLIENTE_ID = 'grupobaco'

interface Cargo {
  id: string
  nombre: string
  orden: number | null
}

export default function CargosTabla() {
  const supabase = createClient()

  const [filas, setFilas] = useState<Cargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [eliminando, setEliminando] = useState<Cargo | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const editando = editandoId !== null

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('cargos')
        .select('id, nombre, orden')
        .eq('cliente_id', CLIENTE_ID)
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar los cargos: ${err.message}`)
      } else {
        setFilas((data ?? []) as Cargo[])
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  function limpiarForm() {
    setEditandoId(null)
    setNombre('')
  }

  function abrirEdicion(f: Cargo) {
    setEditandoId(f.id)
    setNombre(f.nombre)
  }

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)

    if (editando) {
      const { data, error: err } = await supabase
        .from('cargos')
        .update({ nombre: nombre.trim() })
        .eq('id', editandoId!)
        .select('id, nombre, orden')
        .single()

      setGuardando(false)
      if (err) {
        setError(`No se pudo actualizar el cargo: ${err.message}`)
        return
      }
      setFilas((prev) =>
        prev.map((f) => (f.id === editandoId ? (data as Cargo) : f))
      )
      limpiarForm()
      return
    }

    const maxOrden = filas.reduce((m, f) => Math.max(m, f.orden ?? 0), 0)
    const { data, error: err } = await supabase
      .from('cargos')
      .insert({
        cliente_id: CLIENTE_ID,
        nombre: nombre.trim(),
        orden: maxOrden + 1,
        activo: true,
      })
      .select('id, nombre, orden')
      .single()

    setGuardando(false)
    if (err) {
      setError(`No se pudo agregar el cargo: ${err.message}`)
      return
    }
    setFilas((prev) => [...prev, data as Cargo])
    limpiarForm()
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setConfirmando(true)
    setError(null)

    const { error: err } = await supabase
      .from('cargos')
      .update({ activo: false })
      .eq('id', eliminando.id)

    setConfirmando(false)
    if (err) {
      setError(`No se pudo eliminar el cargo: ${err.message}`)
      setEliminando(null)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== eliminando.id))
    if (editandoId === eliminando.id) limpiarForm()
    setEliminando(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Cargos</h2>
        <p className="text-sm text-gray-500">
          {cargando
            ? 'Cargando…'
            : `${filas.length} cargo${filas.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 p-5 space-y-4">
        <div className="text-sm font-semibold text-gray-900">
          {editando ? 'Editar cargo' : 'Nuevo cargo'}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Auxiliar de Farmacia"
              className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {editando && (
            <button
              onClick={limpiarForm}
              disabled={guardando}
              className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={guardar}
            disabled={guardando || cargando}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar cargo'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium w-16">#</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium w-32 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Cargando cargos…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No hay cargos.
                </td>
              </tr>
            ) : (
              filas.map((f, i) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {f.nombre}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => abrirEdicion(f)}
                      className="text-accent text-xs font-medium hover:underline"
                    >
                      Editar
                    </button>
                    <span className="text-gray-300 mx-2">|</span>
                    <button
                      onClick={() => setEliminando(f)}
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

      {eliminando && (
        <ConfirmDialog
          mensaje={`¿Eliminar el cargo ${eliminando.nombre}? Esta acción lo quitará del sistema.`}
          confirmando={confirmando}
          onCancel={() => setEliminando(null)}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  )
}
