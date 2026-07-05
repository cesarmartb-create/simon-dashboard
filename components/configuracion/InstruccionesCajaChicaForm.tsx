'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clienteId: string
}

/**
 * Editor del texto de ayuda de caja chica (configuracion_cliente.
 * instrucciones_caja_chica). Gemelo de AgenteForm, pero con el cliente
 * inyectado desde el server (sin hardcode 'grupobaco').
 */
export default function InstruccionesCajaChicaForm({ clienteId }: Props) {
  const supabase = createClient()

  const [texto, setTexto] = useState('')
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
        .select('instrucciones_caja_chica')
        .eq('cliente_id', clienteId)
        .maybeSingle<{ instrucciones_caja_chica: string | null }>()

      if (!activo) return
      if (err) {
        setError(`No se pudieron cargar las instrucciones: ${err.message}`)
      } else if (data) {
        setTexto(data.instrucciones_caja_chica ?? '')
      }
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase, clienteId])

  async function guardar() {
    setGuardando(true)
    setError(null)
    setGuardado(false)

    const { error: err } = await supabase.from('configuracion_cliente').upsert(
      {
        cliente_id: clienteId,
        instrucciones_caja_chica: texto.trim() || null,
      },
      { onConflict: 'cliente_id' }
    )

    setGuardando(false)
    if (err) {
      setError(`No se pudieron guardar las instrucciones: ${err.message}`)
      return
    }
    setGuardado(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Instrucciones de caja chica
        </h2>
        <p className="text-sm text-gray-500">
          Se muestran como panel de ayuda en la pantalla de caja chica y en el
          detalle de cada rendición.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 p-5 space-y-4">
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setGuardado(false)
          }}
          rows={6}
          disabled={cargando}
          placeholder="Reglas de caja chica para el equipo (topes, plazos, qué documentos adjuntar…)."
          className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
        />
        <div className="flex items-center justify-end gap-3">
          {guardado && (
            <span className="text-sm text-emerald-700">Guardado ✓</span>
          )}
          <button
            onClick={guardar}
            disabled={guardando || cargando}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {guardando ? 'Guardando…' : 'Guardar instrucciones'}
          </button>
        </div>
      </div>
    </div>
  )
}
