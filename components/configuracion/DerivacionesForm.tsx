'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CLIENTE_ID = 'grupobaco'

interface Derivaciones {
  responsable_operaciones: string
  correo_operaciones: string
  responsable_cumplimiento: string
  correo_cumplimiento: string
  copia_automatica: string
}

const VACIO: Derivaciones = {
  responsable_operaciones: '',
  correo_operaciones: '',
  responsable_cumplimiento: '',
  correo_cumplimiento: '',
  copia_automatica: '',
}

export default function DerivacionesForm() {
  const supabase = createClient()

  const [datos, setDatos] = useState<Derivaciones>(VACIO)
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
        .select(
          'responsable_operaciones, correo_operaciones, responsable_cumplimiento, correo_cumplimiento, copia_automatica'
        )
        .eq('cliente_id', CLIENTE_ID)
        .maybeSingle()

      if (!activo) return
      if (err) {
        setError(`No se pudo cargar la configuración: ${err.message}`)
      } else if (data) {
        setDatos({
          responsable_operaciones: data.responsable_operaciones ?? '',
          correo_operaciones: data.correo_operaciones ?? '',
          responsable_cumplimiento: data.responsable_cumplimiento ?? '',
          correo_cumplimiento: data.correo_cumplimiento ?? '',
          copia_automatica: data.copia_automatica ?? '',
        })
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase])

  function actualizar(campo: keyof Derivaciones, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }))
    setGuardado(false)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setGuardado(false)

    const { error: err } = await supabase
      .from('configuracion_cliente')
      .upsert({ cliente_id: CLIENTE_ID, ...datos }, { onConflict: 'cliente_id' })

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
        <h2 className="text-lg font-semibold text-gray-900">Derivaciones</h2>
        <p className="text-sm text-gray-500">
          Define quién recibe cada tipo de consulta y a qué correo se notifica.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
          Cargando configuración…
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 divide-y divide-gray-100">
            <FilaResponsable
              etiqueta="Operaciones"
              descripcion="Consultas operativas y administrativas del día a día."
              responsable={datos.responsable_operaciones}
              correo={datos.correo_operaciones}
              onResponsable={(v) => actualizar('responsable_operaciones', v)}
              onCorreo={(v) => actualizar('correo_operaciones', v)}
            />
            <FilaResponsable
              etiqueta="Cumplimiento"
              descripcion="Consultas relacionadas con normativa y cumplimiento."
              responsable={datos.responsable_cumplimiento}
              correo={datos.correo_cumplimiento}
              onResponsable={(v) => actualizar('responsable_cumplimiento', v)}
              onCorreo={(v) => actualizar('correo_cumplimiento', v)}
            />
            <div className="p-5 grid grid-cols-3 gap-4 items-start">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Copia automática
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Direcciones que reciben copia de todas las derivaciones.
                </div>
              </div>
              <div className="col-span-2 flex flex-col">
                <label className="text-xs font-medium text-gray-700 mb-1">
                  Correos (separados por coma)
                </label>
                <input
                  type="text"
                  value={datos.copia_automatica}
                  onChange={(e) => actualizar('copia_automatica', e.target.value)}
                  placeholder="correo1@grupobaco.cl, correo2@grupobaco.cl"
                  className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
                />
              </div>
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

function FilaResponsable({
  etiqueta,
  descripcion,
  responsable,
  correo,
  onResponsable,
  onCorreo,
}: {
  etiqueta: string
  descripcion: string
  responsable: string
  correo: string
  onResponsable: (v: string) => void
  onCorreo: (v: string) => void
}) {
  return (
    <div className="p-5 grid grid-cols-3 gap-4 items-start">
      <div>
        <div className="text-sm font-medium text-gray-900">{etiqueta}</div>
        <div className="text-xs text-gray-500 mt-1">{descripcion}</div>
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Responsable
        </label>
        <input
          type="text"
          value={responsable}
          onChange={(e) => onResponsable(e.target.value)}
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Correo</label>
        <input
          type="email"
          value={correo}
          onChange={(e) => onCorreo(e.target.value)}
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}
