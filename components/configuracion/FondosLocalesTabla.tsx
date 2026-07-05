'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clienteId: string
}

interface Fila {
  localId: string
  codigo: string
  nombre: string
  localKey: string // "codigo — nombre": misma convencion que rendiciones/ajustes
  monto: string
  correo: string
  guardando: boolean
  guardado: boolean
}

export default function FondosLocalesTabla({ clienteId }: Props) {
  const supabase = createClient()
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)

      const [{ data: locales, error: e1 }, { data: fondos, error: e2 }] =
        await Promise.all([
          supabase
            .from('locales')
            .select('id, codigo, nombre, correo')
            .eq('cliente_id', clienteId)
            .eq('activo', true)
            .order('orden', { ascending: true }),
          supabase
            .from('fondos_caja_chica')
            .select('local, monto_asignado, activo')
            .eq('cliente_id', clienteId)
            .eq('activo', true),
        ])

      if (!activo) return
      if (e1 || e2) {
        setError(`No se pudo cargar la configuración: ${(e1 ?? e2)?.message}`)
        setCargando(false)
        return
      }

      const fondoPorLocal = new Map<string, number>()
      for (const f of fondos ?? []) {
        fondoPorLocal.set(f.local as string, Number(f.monto_asignado))
      }

      const nuevas: Fila[] = (locales ?? []).map((l) => {
        const localKey = `${l.codigo} — ${l.nombre}`
        const monto = fondoPorLocal.get(localKey)
        return {
          localId: l.id as string,
          codigo: l.codigo as string,
          nombre: l.nombre as string,
          localKey,
          monto: monto != null ? String(monto) : '',
          correo: (l.correo as string | null) ?? '',
          guardando: false,
          guardado: false,
        }
      })
      setFilas(nuevas)
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [supabase, clienteId])

  function actualizar(localId: string, campo: 'monto' | 'correo', valor: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.localId === localId ? { ...f, [campo]: valor, guardado: false } : f
      )
    )
  }

  async function guardarFila(fila: Fila) {
    setError(null)
    setFilas((prev) =>
      prev.map((f) => (f.localId === fila.localId ? { ...f, guardando: true } : f))
    )

    // 1) Correo del local (fuente primaria del recordatorio).
    const { error: eCorreo } = await supabase
      .from('locales')
      .update({ correo: fila.correo.trim() || null })
      .eq('id', fila.localId)
      .eq('cliente_id', clienteId)

    // 2) Fondo: monto vacio => desactivar (sin fondo); con monto => upsert activo.
    let eFondo = null
    const montoTxt = fila.monto.trim()
    if (montoTxt === '') {
      const { error } = await supabase
        .from('fondos_caja_chica')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq('cliente_id', clienteId)
        .eq('local', fila.localKey)
      eFondo = error
    } else {
      const monto = Number(montoTxt)
      if (isNaN(monto) || monto < 0) {
        setFilas((prev) =>
          prev.map((f) =>
            f.localId === fila.localId ? { ...f, guardando: false } : f
          )
        )
        setError(`Monto inválido para ${fila.codigo}.`)
        return
      }
      const { error } = await supabase.from('fondos_caja_chica').upsert(
        {
          cliente_id: clienteId,
          local: fila.localKey,
          monto_asignado: monto,
          activo: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cliente_id,local' }
      )
      eFondo = error
    }

    if (eCorreo || eFondo) {
      setFilas((prev) =>
        prev.map((f) =>
          f.localId === fila.localId ? { ...f, guardando: false } : f
        )
      )
      setError(`No se pudo guardar ${fila.codigo}: ${(eCorreo ?? eFondo)?.message}`)
      return
    }

    setFilas((prev) =>
      prev.map((f) =>
        f.localId === fila.localId
          ? { ...f, guardando: false, guardado: true }
          : f
      )
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Fondos y correo por local
        </h2>
        <p className="text-sm text-gray-500">
          Deja el monto vacío para una unidad sin fondo. El correo se usa para el
          recordatorio de fin de mes.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium w-40">Fondo (monto)</th>
              <th className="px-4 py-3 font-medium w-64">Correo</th>
              <th className="px-4 py-3 font-medium w-28 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No hay locales.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.localId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">
                    <span className="font-medium text-gray-900">{f.codigo}</span>
                    <span className="block text-xs text-gray-400">{f.nombre}</span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={f.monto}
                      onChange={(e) =>
                        actualizar(f.localId, 'monto', e.target.value)
                      }
                      placeholder="Sin fondo"
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="email"
                      value={f.correo}
                      onChange={(e) =>
                        actualizar(f.localId, 'correo', e.target.value)
                      }
                      placeholder="correo@…"
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
                    />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => guardarFila(f)}
                      disabled={f.guardando}
                      className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                    >
                      {f.guardando ? 'Guardando…' : f.guardado ? 'Guardado ✓' : 'Guardar'}
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
