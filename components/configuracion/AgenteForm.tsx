'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CLIENTE_ID = 'grupobaco'

export default function AgenteForm() {
  const supabase = createClient()

  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [horario, setHorario] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('configuracion_cliente')
        .select('nombre_agente, empresa, horario_atencion')
        .eq('cliente_id', CLIENTE_ID)
        .maybeSingle()

      if (!activo) return
      if (err) {
        setError(`No se pudo cargar la configuración del agente: ${err.message}`)
      } else if (data) {
        setNombre(data.nombre_agente ?? '')
        setEmpresa(data.empresa ?? '')
        setHorario(data.horario_atencion ?? '')
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  async function guardar() {
    setGuardando(true)
    setError(null)
    setGuardado(false)

    const { error: err } = await supabase.from('configuracion_cliente').upsert(
      {
        cliente_id: CLIENTE_ID,
        nombre_agente: nombre,
        empresa,
        horario_atencion: horario,
      },
      { onConflict: 'cliente_id' }
    )

    setGuardando(false)

    if (err) {
      setError(`No se pudieron guardar los cambios: ${err.message}`)
      return
    }
    setGuardado(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Agente</h2>
        <p className="text-sm text-gray-500">
          Configuración general del asistente Simón.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
          Cargando configuración del agente…
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 p-5 space-y-4 max-w-2xl">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Nombre del agente
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  setGuardado(false)
                }}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Empresa
              </label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => {
                  setEmpresa(e.target.value)
                  setGuardado(false)
                }}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Horario de atención
              </label>
              <input
                type="text"
                value={horario}
                onChange={(e) => {
                  setHorario(e.target.value)
                  setGuardado(false)
                }}
                className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">
                Límite mensual de conversaciones
              </label>
              <input
                type="text"
                value="5.000"
                disabled
                readOnly
                className="px-3 py-2 border border-gray-200 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <span className="text-xs text-gray-400 mt-1">
                Este valor solo puede ser modificado por Budo AI.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={guardar}
              disabled={guardando}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {guardado && (
              <span className="text-sm text-emerald-700">
                Cambios guardados correctamente.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
