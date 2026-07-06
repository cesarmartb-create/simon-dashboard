'use client'

import { useState } from 'react'
import GastosTabla, { type GastoConTipo } from './GastosTabla'
import GastoForm from './GastoForm'
import type { AdjuntoConUrl } from '@/lib/adjuntos'

interface Props {
  rendicionId: string
  clienteId: string
  gastos: GastoConTipo[]
  adjuntosPorGasto: Record<string, AdjuntoConUrl[]>
  tipos: { id: string; nombre: string }[]
  modoRevision: boolean
  modoEdicion: boolean
}

/**
 * Compone la tabla de gastos con el formulario de alta/edicion. Mantiene el
 * gasto en edicion en estado local; el formulario se prefilla al elegir "Editar".
 */
export default function GastosSection({
  rendicionId,
  clienteId,
  gastos,
  adjuntosPorGasto,
  tipos,
  modoRevision,
  modoEdicion,
}: Props) {
  const [editando, setEditando] = useState<GastoConTipo | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Gastos ({gastos.length})
        </h3>
        <GastosTabla
          rendicionId={rendicionId}
          gastos={gastos}
          adjuntosPorGasto={adjuntosPorGasto}
          modoRevision={modoRevision}
          modoEdicion={modoEdicion}
          onEditar={modoEdicion ? setEditando : undefined}
        />
      </div>

      {modoEdicion && (
        <GastoForm
          rendicionId={rendicionId}
          clienteId={clienteId}
          tipos={tipos}
          gastoEditar={editando}
          boletasExistentes={editando ? (adjuntosPorGasto[editando.id] ?? []) : []}
          onDone={() => setEditando(null)}
        />
      )}
    </div>
  )
}
