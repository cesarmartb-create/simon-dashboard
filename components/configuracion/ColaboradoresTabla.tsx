'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from './ConfirmDialog'

const CLIENTE_ID = 'grupobaco'

interface Colaborador {
  id: string
  nombre: string
  numero: string
  cargo: string
  local: string
  rol_portal: string
}

interface LocalOpcion {
  id: string
  codigo: string | null
  nombre: string
}

interface CargoOpcion {
  id: string
  nombre: string
}

const ROLES_PORTAL: { value: string; descripcion: string }[] = [
  { value: 'gestor', descripcion: 'Gestiona sus casos' },
  {
    value: 'operador',
    descripcion: 'Gestiona sus casos + administra colaboradores',
  },
  { value: 'supervisor', descripcion: 'Ve todos los casos y métricas' },
  { value: 'admin', descripcion: 'Acceso completo incluyendo configuración' },
]

const VACIO: Omit<Colaborador, 'id'> = {
  nombre: '',
  numero: '',
  cargo: '',
  local: '',
  rol_portal: 'gestor',
}

export default function ColaboradoresTabla() {
  const supabase = createClient()

  const [filas, setFilas] = useState<Colaborador[]>([])
  const [locales, setLocales] = useState<LocalOpcion[]>([])
  const [cargos, setCargos] = useState<CargoOpcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [datos, setDatos] = useState<Omit<Colaborador, 'id'>>(VACIO)
  const [guardando, setGuardando] = useState(false)

  const [eliminando, setEliminando] = useState<Colaborador | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)

      const [colab, locs, cgs] = await Promise.all([
        supabase
          .from('colaboradores')
          .select('id, nombre, numero, cargo, local, rol_portal')
          .eq('cliente_id', CLIENTE_ID)
          .eq('activo', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('locales')
          .select('id, codigo, nombre')
          .eq('cliente_id', CLIENTE_ID)
          .eq('activo', true)
          .order('orden', { ascending: true }),
        supabase
          .from('cargos')
          .select('id, nombre')
          .eq('cliente_id', CLIENTE_ID)
          .eq('activo', true)
          .order('orden', { ascending: true }),
      ])

      if (!activo) return

      if (colab.error) {
        setError(`No se pudieron cargar los colaboradores: ${colab.error.message}`)
      } else {
        setFilas((colab.data ?? []) as Colaborador[])
      }

      if (locs.error) {
        setError(`No se pudieron cargar los locales: ${locs.error.message}`)
      } else {
        setLocales((locs.data ?? []) as LocalOpcion[])
      }

      if (cgs.error) {
        setError(`No se pudieron cargar los cargos: ${cgs.error.message}`)
      } else {
        setCargos((cgs.data ?? []) as CargoOpcion[])
      }

      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  const sinLocales = !cargando && locales.length === 0
  const sinCargos = !cargando && cargos.length === 0
  const faltaCatalogo = sinLocales || sinCargos
  const editando = editandoId !== null

  function abrirAgregar() {
    setEditandoId(null)
    setDatos({
      ...VACIO,
      local: locales[0]?.codigo ?? locales[0]?.nombre ?? '',
      cargo: cargos[0]?.nombre ?? '',
    })
    setMostrarForm(true)
  }

  function abrirEdicion(f: Colaborador) {
    setEditandoId(f.id)
    setDatos({
      nombre: f.nombre,
      numero: f.numero,
      cargo: f.cargo,
      local: f.local,
      rol_portal: f.rol_portal,
    })
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setDatos(VACIO)
  }

  async function guardar() {
    if (!datos.nombre.trim() || !datos.local) return
    if (!editando && !datos.numero.trim()) return

    setGuardando(true)
    setError(null)

    const camposComunes = {
      nombre: datos.nombre.trim(),
      cargo: datos.cargo,
      local: datos.local,
      rol_portal: datos.rol_portal,
    }

    if (editando) {
      const { data, error: err } = await supabase
        .from('colaboradores')
        .update(camposComunes)
        .eq('id', editandoId!)
        .select('id, nombre, numero, cargo, local, rol_portal')
        .single()

      setGuardando(false)
      if (err) {
        setError(`No se pudo actualizar el colaborador: ${err.message}`)
        return
      }
      setFilas((prev) =>
        prev.map((f) => (f.id === editandoId ? (data as Colaborador) : f))
      )
      cerrarForm()
      return
    }

    // Alta: re-activar si el número ya existe pero está inactivo.
    const numero = datos.numero.trim()
    const { data: inactivo, error: errBusca } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('cliente_id', CLIENTE_ID)
      .eq('numero', numero)
      .eq('activo', false)
      .maybeSingle()

    if (errBusca) {
      setGuardando(false)
      setError(`No se pudo verificar el número: ${errBusca.message}`)
      return
    }

    if (inactivo) {
      const { data, error: err } = await supabase
        .from('colaboradores')
        .update({ ...camposComunes, activo: true })
        .eq('id', inactivo.id)
        .select('id, nombre, numero, cargo, local, rol_portal')
        .single()

      setGuardando(false)
      if (err) {
        setError(`No se pudo reactivar el colaborador: ${err.message}`)
        return
      }
      setFilas((prev) => [...prev, data as Colaborador])
      cerrarForm()
      return
    }

    const { data, error: err } = await supabase
      .from('colaboradores')
      .insert({ cliente_id: CLIENTE_ID, numero, ...camposComunes, activo: true })
      .select('id, nombre, numero, cargo, local, rol_portal')
      .single()

    setGuardando(false)
    if (err) {
      setError(`No se pudo agregar el colaborador: ${err.message}`)
      return
    }
    setFilas((prev) => [...prev, data as Colaborador])
    cerrarForm()
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setConfirmando(true)
    setError(null)

    const { error: err } = await supabase
      .from('colaboradores')
      .update({ activo: false })
      .eq('id', eliminando.id)

    setConfirmando(false)
    if (err) {
      setError(`No se pudo eliminar el colaborador: ${err.message}`)
      setEliminando(null)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== eliminando.id))
    setEliminando(null)
  }

  // colaboradores.local guarda el CODIGO ('F0313'); el form de casos/ajustes
  // filtra por ese codigo, y aqui el option guarda l.codigo por lo mismo.
  const localEnLista = locales.some((l) => (l.codigo ?? l.nombre) === datos.local)
  const cargoEnLista = cargos.some((c) => c.nombre === datos.cargo)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Colaboradores</h2>
          <p className="text-sm text-gray-500">
            {cargando
              ? 'Cargando…'
              : `${filas.length} colaborador${filas.length === 1 ? '' : 'es'}`}
          </p>
        </div>
        <button
          onClick={() => (mostrarForm ? cerrarForm() : abrirAgregar())}
          disabled={cargando || (faltaCatalogo && !mostrarForm)}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {mostrarForm ? 'Cancelar' : 'Agregar colaborador'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {sinLocales && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          Primero crea locales en la tab Locales.
        </div>
      )}

      {sinCargos && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          Primero crea cargos en la tab Cargos.
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white border border-gray-200 p-5 space-y-4">
          <div className="text-sm font-semibold text-gray-900">
            {editando ? 'Editar colaborador' : 'Nuevo colaborador'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Campo
              label="Nombre"
              value={datos.nombre}
              onChange={(v) => setDatos((d) => ({ ...d, nombre: v }))}
            />

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Número {editando && '(no editable)'}
              </label>
              <input
                type="text"
                value={datos.numero}
                disabled={editando}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, numero: e.target.value }))
                }
                className={`px-3 py-2 border text-sm focus:outline-none focus:border-accent ${
                  editando
                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'border-gray-300 bg-white'
                }`}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Cargo
              </label>
              <select
                value={datos.cargo}
                onChange={(e) => setDatos((d) => ({ ...d, cargo: e.target.value }))}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {!cargoEnLista && datos.cargo && (
                  <option value={datos.cargo}>{datos.cargo}</option>
                )}
                {cargos.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Local
              </label>
              <select
                value={datos.local}
                onChange={(e) => setDatos((d) => ({ ...d, local: e.target.value }))}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {!localEnLista && datos.local && (
                  <option value={datos.local}>{datos.local}</option>
                )}
                {locales.map((l) => (
                  <option key={l.id} value={l.codigo ?? l.nombre}>
                    {l.codigo ? `${l.codigo} — ${l.nombre}` : l.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Rol portal
              </label>
              <select
                value={datos.rol_portal}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, rol_portal: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {ROLES_PORTAL.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.value} — {r.descripcion}
                  </option>
                ))}
              </select>
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
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">Rol portal</th>
              <th className="px-4 py-3 font-medium w-32 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Cargando colaboradores…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No hay colaboradores.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {f.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{f.numero}</td>
                  <td className="px-4 py-3 text-gray-700">{f.cargo}</td>
                  <td className="px-4 py-3 text-gray-700">{f.local}</td>
                  <td className="px-4 py-3 text-gray-700">{f.rol_portal}</td>
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
          mensaje={`¿Eliminar a ${eliminando.nombre}? Esta acción lo quitará del sistema.`}
          confirmando={confirmando}
          onCancel={() => setEliminando(null)}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  )
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
      />
    </div>
  )
}
