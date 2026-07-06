'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from './ConfirmDialog'

interface TipoGastoFila {
  id: string
  codigo: string
  nombre: string
  orden: number | null
}

interface Props {
  clienteId: string
}

/**
 * Mensaje de codigo duplicado que distingue si el choque es contra un tipo
 * ACTIVO o uno DESACTIVADO (soft-delete): el unique (cliente_id, codigo)
 * incluye las filas inactivas.
 */
function mensajeDuplicado(codigo: string, desactivados: TipoGastoFila[]): string {
  const enDesactivados = desactivados.some((d) => d.codigo === codigo)
  return enDesactivados
    ? "Ese codigo pertenece a un tipo desactivado. Reactivalo desde 'Ver desactivados'."
    : 'Ese codigo ya existe para este cliente.'
}

export default function TiposGastoTabla({ clienteId }: Props) {
  const supabase = createClient()

  const [filas, setFilas] = useState<TipoGastoFila[]>([])
  const [desactivados, setDesactivados] = useState<TipoGastoFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [eliminando, setEliminando] = useState<TipoGastoFila | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const [verDesactivados, setVerDesactivados] = useState(false)
  const [reactivandoId, setReactivandoId] = useState<string | null>(null)

  const editando = editandoId !== null

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('tipos_gasto')
        .select('id, codigo, nombre, orden, activo')
        .eq('cliente_id', clienteId)
        .order('orden', { ascending: true })

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar los tipos de gasto: ${err.message}`)
      } else {
        const todos = (data ?? []) as (TipoGastoFila & { activo: boolean })[]
        const soloDatos = ({ activo: _a, ...r }: TipoGastoFila & { activo: boolean }) => r
        setFilas(todos.filter((t) => t.activo).map(soloDatos))
        setDesactivados(todos.filter((t) => !t.activo).map(soloDatos))
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase, clienteId])

  function limpiarForm() {
    setEditandoId(null)
    setCodigo('')
    setNombre('')
  }

  function abrirEdicion(f: TipoGastoFila) {
    // Carga SIEMPRE la fila clickeada y resetea estado previo.
    setError(null)
    setGuardando(false)
    setEditandoId(f.id)
    setCodigo(f.codigo)
    setNombre(f.nombre)
  }

  async function guardar() {
    const cod = codigo.trim()
    const nom = nombre.trim()
    if (!cod || !nom) return
    setGuardando(true)
    setError(null)

    // EDITAR: update por id. Si choca (23505), distinguir activo/desactivado.
    if (editando) {
      const { data, error: err } = await supabase
        .from('tipos_gasto')
        .update({ codigo: cod, nombre: nom })
        .eq('id', editandoId!)
        .eq('cliente_id', clienteId)
        .select('id, codigo, nombre, orden')
        .single()

      setGuardando(false)
      if (err) {
        setError(
          err.code === '23505'
            ? mensajeDuplicado(cod, desactivados)
            : `No se pudo actualizar el tipo: ${err.message}`
        )
        return
      }
      setFilas((prev) =>
        prev.map((f) => (f.id === editandoId ? (data as TipoGastoFila) : f))
      )
      limpiarForm()
      return
    }

    // AGREGAR: si existe una fila DESACTIVADA con este codigo, REACTIVARLA
    // (activo=true + nombre nuevo) en vez de insertar.
    const inactivo = desactivados.find((d) => d.codigo === cod)
    if (inactivo) {
      const { data, error: err } = await supabase
        .from('tipos_gasto')
        .update({ activo: true, nombre: nom })
        .eq('id', inactivo.id)
        .eq('cliente_id', clienteId)
        .select('id, codigo, nombre, orden')
        .single()

      setGuardando(false)
      if (err) {
        setError(`No se pudo reactivar el tipo: ${err.message}`)
        return
      }
      setDesactivados((prev) => prev.filter((d) => d.id !== inactivo.id))
      setFilas((prev) => [...prev, data as TipoGastoFila])
      limpiarForm()
      return
    }

    const maxOrden = filas.reduce((m, f) => Math.max(m, f.orden ?? 0), 0)
    const { data, error: err } = await supabase
      .from('tipos_gasto')
      .insert({
        cliente_id: clienteId,
        codigo: cod,
        nombre: nom,
        orden: maxOrden + 1,
        activo: true,
      })
      .select('id, codigo, nombre, orden')
      .single()

    setGuardando(false)
    if (err) {
      setError(
        err.code === '23505'
          ? mensajeDuplicado(cod, desactivados)
          : `No se pudo agregar el tipo: ${err.message}`
      )
      return
    }
    setFilas((prev) => [...prev, data as TipoGastoFila])
    limpiarForm()
  }

  async function reactivar(f: TipoGastoFila) {
    setReactivandoId(f.id)
    setError(null)
    const { data, error: err } = await supabase
      .from('tipos_gasto')
      .update({ activo: true })
      .eq('id', f.id)
      .eq('cliente_id', clienteId)
      .select('id, codigo, nombre, orden')
      .single()

    setReactivandoId(null)
    if (err) {
      setError(`No se pudo reactivar el tipo: ${err.message}`)
      return
    }
    setDesactivados((prev) => prev.filter((d) => d.id !== f.id))
    setFilas((prev) => [...prev, data as TipoGastoFila])
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setConfirmando(true)
    setError(null)

    const { error: err } = await supabase
      .from('tipos_gasto')
      .update({ activo: false })
      .eq('id', eliminando.id)
      .eq('cliente_id', clienteId)

    setConfirmando(false)
    if (err) {
      setError(`No se pudo eliminar el tipo: ${err.message}`)
      setEliminando(null)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== eliminando.id))
    setDesactivados((prev) => [...prev, eliminando])
    if (editandoId === eliminando.id) limpiarForm()
    setEliminando(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Tipos de gasto</h2>
        <p className="text-sm text-gray-500">
          {cargando
            ? 'Cargando…'
            : `${filas.length} tipo${filas.length === 1 ? '' : 's'} activo${filas.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 p-5 space-y-4">
        <div className="text-sm font-semibold text-gray-900">
          {editando ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto'}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Código
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ej. movilizacion"
              className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Movilizacion y transporte"
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
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar tipo'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium w-16">#</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium w-32 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Cargando tipos…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No hay tipos de gasto activos.
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

      {desactivados.length > 0 && (
        <div>
          <button
            onClick={() => setVerDesactivados((v) => !v)}
            className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
          >
            {verDesactivados ? 'Ocultar' : 'Ver'} desactivados ({desactivados.length})
          </button>

          {verDesactivados && (
            <div className="bg-white border border-gray-200 overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium w-32 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {desactivados.map((f) => (
                    <tr key={f.id} className="text-gray-400">
                      <td className="px-4 py-3">{f.codigo}</td>
                      <td className="px-4 py-3">{f.nombre}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => reactivar(f)}
                          disabled={reactivandoId === f.id}
                          className="text-accent text-xs font-medium hover:underline disabled:opacity-40"
                        >
                          {reactivandoId === f.id ? 'Reactivando…' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {eliminando && (
        <ConfirmDialog
          mensaje={`¿Eliminar el tipo de gasto "${eliminando.nombre}"? Quedará desactivado (puedes reactivarlo luego).`}
          confirmando={confirmando}
          onCancel={() => setEliminando(null)}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  )
}
