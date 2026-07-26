'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AjusteInventario } from '@/types/ajuste'
import { DIRECCION_AJUSTE_LABEL } from '@/types/ajuste'
import EstadoAjusteBadge from './EstadoAjusteBadge'
import { formatFechaCorta, formatCLP, diasEntre, cn } from '@/lib/utils'

export type AjusteConTipo = AjusteInventario & {
  tipos_ajuste: { nombre: string } | null
}

const DIAS_ALERTA = 15

interface Props {
  ajustes: AjusteConTipo[]
}

type Direccion = 'asc' | 'desc'

type Valor = string | number | null

const ACCESORES: Record<string, (a: AjusteConTipo) => Valor> = {
  fecha: (a) => new Date(a.created_at).getTime(),
  local: (a) => a.local ?? '',
  tipo: (a) => a.tipos_ajuste?.nombre ?? '',
  direccion: (a) => a.direccion,
  cantidad_sku: (a) => a.cantidad_sku,
  monto: (a) => a.monto,
  estado: (a) => a.estado,
  folio: (a) => a.folio_ajuste,
  dias: (a) => diasEntre(a.created_at),
}

function esVacio(v: Valor): boolean {
  return v === null || v === ''
}

/**
 * Folio es texto libre hoy (puede tener formato mixto): si ambos lados
 * parsean como numero, compara numerico; si no, degrada a texto. Los
 * vacios (folio y monto pueden ser null) siempre van al final.
 */
function comparar(
  a: AjusteConTipo,
  b: AjusteConTipo,
  campo: string,
  direccion: Direccion
): number {
  const signo = direccion === 'asc' ? 1 : -1
  const va = ACCESORES[campo](a)
  const vb = ACCESORES[campo](b)

  const vaVacio = esVacio(va)
  const vbVacio = esVacio(vb)
  if (vaVacio && vbVacio) return 0
  if (vaVacio) return 1
  if (vbVacio) return -1

  if (campo === 'folio') {
    const na = Number(va)
    const nb = Number(vb)
    if (!isNaN(na) && !isNaN(nb)) return (na - nb) * signo
    return String(va).localeCompare(String(vb)) * signo
  }

  if (typeof va === 'number' && typeof vb === 'number') {
    return (va - vb) * signo
  }

  return String(va).localeCompare(String(vb)) * signo
}

export default function AjustesTabla({ ajustes }: Props) {
  const [orden, setOrden] = useState<{ campo: string | null; direccion: Direccion }>(
    { campo: null, direccion: 'asc' }
  )

  function ordenarPor(campo: string) {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, direccion: prev.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: 'asc' }
    )
  }

  function thOrdenable(campo: string, label: string, alignRight = false) {
    const activa = orden.campo === campo
    return (
      <th
        key={campo}
        onClick={() => ordenarPor(campo)}
        className={cn(
          'px-4 py-3 font-medium select-none cursor-pointer hover:text-gray-900',
          alignRight && 'text-right'
        )}
      >
        {label}
        {activa && (orden.direccion === 'asc' ? ' ▲' : ' ▼')}
      </th>
    )
  }

  if (ajustes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
        No hay ajustes que coincidan con los filtros.
      </div>
    )
  }

  const filas =
    orden.campo === null
      ? ajustes
      : [...ajustes].sort((a, b) => comparar(a, b, orden.campo!, orden.direccion))

  return (
    <div className="bg-white border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            {thOrdenable('fecha', 'Fecha')}
            {thOrdenable('local', 'Local')}
            {thOrdenable('tipo', 'Tipo')}
            {thOrdenable('direccion', 'Dirección')}
            {thOrdenable('cantidad_sku', 'Cant. SKU', true)}
            {thOrdenable('monto', 'Monto', true)}
            {thOrdenable('estado', 'Estado')}
            {thOrdenable('folio', 'Folio')}
            {thOrdenable('dias', 'Días', true)}
            <th className="px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map((ajuste) => {
            const dias = diasEntre(ajuste.created_at)
            // Abierto = pendiente o validado: ambos envejecen y alertan.
            const abierto =
              ajuste.estado === 'pendiente' || ajuste.estado === 'validado'
            const alerta = abierto && dias > DIAS_ALERTA
            return (
              <tr
                key={ajuste.id}
                className={cn(
                  'transition-colors',
                  alerta ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
                )}
              >
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatFechaCorta(ajuste.created_at)}
                </td>
                <td className="px-4 py-3 text-gray-700">{ajuste.local}</td>
                <td className="px-4 py-3 text-gray-700">
                  {ajuste.tipos_ajuste?.nombre ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      ajuste.direccion === 'alta'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }
                  >
                    {DIRECCION_AJUSTE_LABEL[ajuste.direccion] ?? ajuste.direccion}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {ajuste.cantidad_sku}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                  {formatCLP(ajuste.monto)}
                </td>
                <td className="px-4 py-3">
                  <EstadoAjusteBadge estado={ajuste.estado} />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {ajuste.folio_ajuste ?? '—'}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right whitespace-nowrap',
                    alerta ? 'font-semibold text-amber-700' : 'text-gray-500'
                  )}
                >
                  {abierto ? dias : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ajustes/${ajuste.id}`}
                    className="text-accent text-xs font-medium hover:underline"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
