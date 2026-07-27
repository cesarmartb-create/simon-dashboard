'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Gestion } from '@/types/gestion'
import { TIPO_GESTION_LABEL, ESTADO_GESTION_LABEL, esVencida } from '@/types/gestion'

interface Props {
  filas: Gestion[]
}

function respondioOLeyo(fila: Gestion): boolean {
  return fila.estado === 'respondida' || fila.estado === 'leida'
}

/** Fila resumen para un envio masivo (mismo grupo_id): progreso + detalle expandible por local. */
export default function GestionGrupoFila({ filas }: Props) {
  const [abierto, setAbierto] = useState(false)
  const primera = filas[0]
  const total = filas.length
  const completados = filas.filter(respondioOLeyo).length
  const verbo = primera.tipo === 'solicitud' ? 'respondieron' : 'leyeron'
  const algunaVencida = filas.some((f) => esVencida(f))

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-2">{TIPO_GESTION_LABEL[primera.tipo]}</td>
        <td className="px-4 py-2">{primera.titulo}</td>
        <td className="px-4 py-2 text-gray-500">Todos los locales</td>
        <td className="px-4 py-2">
          {completados} de {total} {verbo}
          {algunaVencida && (
            <span className="ml-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
              Vencida(s)
            </span>
          )}
        </td>
        <td className="px-4 py-2">{primera.fecha_limite ?? '—'}</td>
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            className="text-xs text-accent hover:underline"
          >
            {abierto ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </td>
      </tr>
      {abierto &&
        filas.map((f) => (
          <tr key={f.id} className="border-b border-gray-100 bg-gray-50/60">
            <td className="px-4 py-2" />
            <td className="px-4 py-2 pl-8">
              <Link
                href={`/gestion/${f.id}`}
                className="text-accent hover:underline"
              >
                {f.local}
              </Link>
            </td>
            <td className="px-4 py-2" colSpan={2}>
              {ESTADO_GESTION_LABEL[f.estado]}
              {esVencida(f) && (
                <span className="ml-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
                  Vencida
                </span>
              )}
            </td>
            <td className="px-4 py-2" colSpan={2} />
          </tr>
        ))}
    </>
  )
}
