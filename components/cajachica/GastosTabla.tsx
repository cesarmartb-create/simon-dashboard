'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { eliminarGasto } from '@/app/(dashboard)/caja-chica/acciones-gastos'
import {
  ESTADO_GASTO_LABEL,
  FORMA_PAGO_LABEL,
  TIPO_DOCUMENTO_LABEL,
  type GastoCajaChica,
  type EstadoGasto,
} from '@/types/cajachica'
import type { AdjuntoConUrl } from '@/lib/adjuntos'
import { formatCLP, formatFechaCorta, cn } from '@/lib/utils'

export type GastoConTipo = GastoCajaChica & {
  tipos_gasto: { nombre: string } | null
}

const ESTADO_GASTO_ESTILO: Record<EstadoGasto, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-300',
  aprobado: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  rechazado: 'bg-red-50 text-red-700 border-red-300',
}

interface Props {
  rendicionId: string
  gastos: GastoConTipo[]
  adjuntosPorGasto: Record<string, AdjuntoConUrl[]>
  modoRevision: boolean
  modoEdicion: boolean
  onEditar?: (g: GastoConTipo) => void
}

export default function GastosTabla({
  rendicionId,
  gastos,
  adjuntosPorGasto,
  modoRevision,
  modoEdicion,
  onEditar,
}: Props) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [rechazandoId, setRechazandoId] = useState<string | null>(null)
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function revisar(
    gastoId: string,
    decision: 'aprobado' | 'rechazado',
    obs?: string
  ) {
    setError(null)
    setOcupado(gastoId)
    const res = await fetch(`/api/caja-chica/${rendicionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'revisar_gasto',
        gasto_id: gastoId,
        decision,
        observacion_rechazo: obs,
      }),
    })
    setOcupado(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo guardar la decisión.')
      return
    }
    setRechazandoId(null)
    setObservacion('')
    router.refresh()
  }

  async function borrar(gastoId: string) {
    setError(null)
    setOcupado(gastoId)
    const r = await eliminarGasto(gastoId)
    setOcupado(null)
    if (!r.ok) {
      setError(r.error ?? 'No se pudo eliminar el gasto.')
      return
    }
    router.refresh()
  }

  if (gastos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
        Aún no hay gastos en esta rendición.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              <th className="px-4 py-3 font-medium">Forma</th>
              <th className="px-4 py-3 font-medium">Doc.</th>
              <th className="px-4 py-3 font-medium">Boleta</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {(modoRevision || modoEdicion) && (
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gastos.map((g) => {
              const boletas = adjuntosPorGasto[g.id] ?? []
              const estilo =
                ESTADO_GASTO_ESTILO[g.estado] ?? ESTADO_GASTO_ESTILO.pendiente
              return (
                <tr key={g.id} className="align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatFechaCorta(g.fecha_gasto)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {g.tipos_gasto?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {g.proveedor ?? '—'}
                    {g.descripcion && (
                      <span className="block text-xs text-gray-400">
                        {g.descripcion}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {formatCLP(g.monto)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {FORMA_PAGO_LABEL[g.forma_pago] ?? g.forma_pago}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {g.tipo_documento === 'sin_documento'
                      ? '—'
                      : `${TIPO_DOCUMENTO_LABEL[g.tipo_documento]}${
                          g.n_documento ? ` ${g.n_documento}` : ''
                        }`}
                  </td>
                  <td className="px-4 py-3">
                    {boletas.length === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      boletas.map((b, i) => {
                        const etiqueta =
                          boletas.length > 1
                            ? `Boleta ${i + 1}/${boletas.length}`
                            : 'Boleta'
                        return b.url ? (
                          <a
                            key={b.id}
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent text-xs font-medium hover:underline block"
                          >
                            {etiqueta}
                          </a>
                        ) : (
                          <span key={b.id} className="text-xs text-gray-400 block">
                            {etiqueta}
                          </span>
                        )
                      })
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 text-xs font-medium border',
                        estilo
                      )}
                    >
                      {ESTADO_GASTO_LABEL[g.estado] ?? g.estado}
                    </span>
                    {g.estado === 'rechazado' && g.observacion_rechazo && (
                      <span className="block text-xs text-red-600 mt-1">
                        {g.observacion_rechazo}
                      </span>
                    )}
                  </td>

                  {(modoRevision || modoEdicion) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {modoEdicion && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => onEditar?.(g)}
                            disabled={ocupado === g.id}
                            className="text-accent text-xs font-medium hover:underline disabled:opacity-40"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => borrar(g.id)}
                            disabled={ocupado === g.id}
                            className="text-red-600 text-xs font-medium hover:underline disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}

                      {modoRevision && g.estado === 'pendiente' && (
                        <div className="flex flex-col items-end gap-1">
                          {rechazandoId === g.id ? (
                            <div className="w-56 space-y-2">
                              <textarea
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                                rows={2}
                                placeholder="Motivo del rechazo…"
                                className="w-full px-2 py-1 border border-gray-300 text-xs bg-white focus:outline-none focus:border-accent resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setRechazandoId(null)
                                    setObservacion('')
                                  }}
                                  className="text-xs text-gray-500 hover:underline"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() =>
                                    revisar(g.id, 'rechazado', observacion.trim())
                                  }
                                  disabled={
                                    ocupado === g.id || !observacion.trim()
                                  }
                                  className="text-xs font-medium text-red-700 hover:underline disabled:opacity-40"
                                >
                                  Confirmar rechazo
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <button
                                onClick={() => revisar(g.id, 'aprobado')}
                                disabled={ocupado === g.id}
                                className="text-emerald-700 text-xs font-medium hover:underline disabled:opacity-40"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => setRechazandoId(g.id)}
                                disabled={ocupado === g.id}
                                className="text-red-600 text-xs font-medium hover:underline disabled:opacity-40"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
