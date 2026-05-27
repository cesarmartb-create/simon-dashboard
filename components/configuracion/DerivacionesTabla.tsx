'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from './ConfirmDialog'

const CLIENTE_ID = 'grupobaco'

interface Area {
  id: string
  nombre: string
  descripcion: string
  responsable_nombre: string
  responsable_correo: string
  orden: number | null
}

type FormData = Omit<Area, 'id' | 'orden'>

const VACIO: FormData = {
  nombre: '',
  descripcion: '',
  responsable_nombre: '',
  responsable_correo: '',
}

export default function DerivacionesTabla() {
  const supabase = createClient()

  const [filas, setFilas] = useState<Area[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [datos, setDatos] = useState<FormData>(VACIO)
  const [guardando, setGuardando] = useState(false)

  const [eliminando, setEliminando] = useState<Area | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const editando = editandoId !== null

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('areas_derivacion')
        .select(
          'id, nombre, descripcion, responsable_nombre, responsable_correo, orden'
        )
        .eq('cliente_id', CLIENTE_ID)
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar las áreas: ${err.message}`)
      } else {
        setFilas((data ?? []) as Area[])
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  function abrirAgregar() {
    setEditandoId(null)
    setDatos(VACIO)
    setMostrarForm(true)
  }

  function abrirEdicion(f: Area) {
    setEditandoId(f.id)
    setDatos({
      nombre: f.nombre,
      descripcion: f.descripcion,
      responsable_nombre: f.responsable_nombre,
      responsable_correo: f.responsable_correo,
    })
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setDatos(VACIO)
  }

  async function guardar() {
    if (!datos.nombre.trim()) return
    setGuardando(true)
    setError(null)

    const campos = {
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion.trim(),
      responsable_nombre: datos.responsable_nombre.trim(),
      responsable_correo: datos.responsable_correo.trim(),
    }

    if (editando) {
      const { data, error: err } = await supabase
        .from('areas_derivacion')
        .update(campos)
        .eq('id', editandoId!)
        .select(
          'id, nombre, descripcion, responsable_nombre, responsable_correo, orden'
        )
        .single()

      setGuardando(false)
      if (err) {
        setError(`No se pudo actualizar el área: ${err.message}`)
        return
      }
      setFilas((prev) =>
        prev.map((f) => (f.id === editandoId ? (data as Area) : f))
      )
      cerrarForm()
      return
    }

    const maxOrden = filas.reduce((m, f) => Math.max(m, f.orden ?? 0), 0)
    const { data, error: err } = await supabase
      .from('areas_derivacion')
      .insert({
        cliente_id: CLIENTE_ID,
        ...campos,
        orden: maxOrden + 1,
        activo: true,
      })
      .select(
        'id, nombre, descripcion, responsable_nombre, responsable_correo, orden'
      )
      .single()

    setGuardando(false)
    if (err) {
      setError(`No se pudo agregar el área: ${err.message}`)
      return
    }
    setFilas((prev) => [...prev, data as Area])
    cerrarForm()
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setConfirmando(true)
    setError(null)

    const { error: err } = await supabase
      .from('areas_derivacion')
      .update({ activo: false })
      .eq('id', eliminando.id)

    setConfirmando(false)
    if (err) {
      setError(`No se pudo eliminar el área: ${err.message}`)
      setEliminando(null)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== eliminando.id))
    if (editandoId === eliminando.id) cerrarForm()
    setEliminando(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Derivaciones</h2>
          <p className="text-sm text-gray-500">
            {cargando
              ? 'Cargando…'
              : `${filas.length} área${filas.length === 1 ? '' : 's'} de derivación`}
          </p>
        </div>
        <button
          onClick={() => (mostrarForm ? cerrarForm() : abrirAgregar())}
          disabled={cargando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {mostrarForm ? 'Cancelar' : 'Agregar área'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white border border-gray-200 p-5 space-y-4">
          <div className="text-sm font-semibold text-gray-900">
            {editando ? 'Editar área' : 'Nueva área'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={datos.nombre}
                onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
                placeholder="Operaciones, RRHH, Cumplimiento…"
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={datos.descripcion}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, descripcion: e.target.value }))
                }
                placeholder="Qué temas cubre esta área"
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Responsable
              </label>
              <input
                type="text"
                value={datos.responsable_nombre}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, responsable_nombre: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Correo responsable
              </label>
              <input
                type="email"
                value={datos.responsable_correo}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, responsable_correo: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={cerrarForm}
              disabled={guardando}
              className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium w-32 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Cargando áreas…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No hay áreas de derivación.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {f.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{f.descripcion}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {f.responsable_nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {f.responsable_correo}
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
          mensaje={`¿Eliminar el área ${eliminando.nombre}? Esta acción la quitará del sistema.`}
          confirmando={confirmando}
          onCancel={() => setEliminando(null)}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  )
}
