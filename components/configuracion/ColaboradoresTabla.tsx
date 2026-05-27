'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CLIENTE_ID = 'grupobaco'

interface Colaborador {
  id: string
  nombre: string
  numero: string
  cargo: string
  local: string
  rol_portal: string
}

const ROLES_PORTAL = ['admin', 'supervisor', 'operador', 'gestor', 'sin acceso']

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
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevo, setNuevo] = useState<Omit<Colaborador, 'id'>>(VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('colaboradores')
        .select('id, nombre, numero, cargo, local, rol_portal')
        .eq('cliente_id', CLIENTE_ID)
        .eq('activo', true)
        .order('created_at', { ascending: true })

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar los colaboradores: ${err.message}`)
      } else {
        setFilas((data ?? []) as Colaborador[])
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
      .from('colaboradores')
      .update({ activo: false })
      .eq('id', id)

    if (err) {
      setError(`No se pudo eliminar el colaborador: ${err.message}`)
      return
    }
    setFilas((prev) => prev.filter((f) => f.id !== id))
  }

  async function agregar() {
    if (!nuevo.nombre.trim()) return
    setGuardando(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('colaboradores')
      .insert({
        cliente_id: CLIENTE_ID,
        nombre: nuevo.nombre.trim(),
        numero: nuevo.numero.trim(),
        cargo: nuevo.cargo.trim(),
        local: nuevo.local.trim(),
        rol_portal: nuevo.rol_portal,
        activo: true,
      })
      .select('id, nombre, numero, cargo, local, rol_portal')
      .single()

    setGuardando(false)

    if (err) {
      setError(`No se pudo agregar el colaborador: ${err.message}`)
      return
    }

    setFilas((prev) => [...prev, data as Colaborador])
    setNuevo(VACIO)
    setMostrarForm(false)
  }

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
          onClick={() => setMostrarForm((v) => !v)}
          disabled={cargando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {mostrarForm ? 'Cancelar' : 'Agregar colaborador'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white border border-gray-200 p-4 grid grid-cols-5 gap-3 items-end">
          <Campo
            label="Nombre"
            value={nuevo.nombre}
            onChange={(v) => setNuevo((n) => ({ ...n, nombre: v }))}
          />
          <Campo
            label="Número"
            value={nuevo.numero}
            onChange={(v) => setNuevo((n) => ({ ...n, numero: v }))}
          />
          <Campo
            label="Cargo"
            value={nuevo.cargo}
            onChange={(v) => setNuevo((n) => ({ ...n, cargo: v }))}
          />
          <Campo
            label="Local"
            value={nuevo.local}
            onChange={(v) => setNuevo((n) => ({ ...n, local: v }))}
          />
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Rol portal
            </label>
            <div className="flex gap-2">
              <select
                value={nuevo.rol_portal}
                onChange={(e) =>
                  setNuevo((n) => ({ ...n, rol_portal: e.target.value }))
                }
                className="flex-1 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              >
                {ROLES_PORTAL.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={agregar}
                disabled={guardando}
                className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-3 py-2 transition-colors"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
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
              <th className="px-4 py-3 font-medium w-20 text-right">Acción</th>
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
