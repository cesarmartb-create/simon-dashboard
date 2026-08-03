'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Gestion } from '@/types/gestion'
import { TIPO_GESTION_LABEL, ESTADO_GESTION_LABEL, esVencida } from '@/types/gestion'
import type { Usuario } from '@/types/usuario'
import { puedeAnularGestion } from '@/lib/gestion'
import { formatFecha } from '@/lib/utils'

interface Props {
  filas: Gestion[]
  usuario: Usuario
  totalesPorGrupo?: Record<string, { total: number; completadas: number }>
}

function respondioOLeyo(fila: Gestion): boolean {
  return fila.estado === 'respondida' || fila.estado === 'leida'
}

/** Fila resumen para un envio masivo (mismo grupo_id): progreso + detalle expandible por local. */
export default function GestionGrupoFila({ filas, usuario, totalesPorGrupo }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const primera = filas[0]
  const totalReal = primera.grupo_id ? totalesPorGrupo?.[primera.grupo_id] : undefined
  const total = totalReal?.total ?? filas.length
  const completados = totalReal?.completadas ?? filas.filter(respondioOLeyo).length
  const verbo = primera.tipo === 'solicitud' ? 'respondieron' : 'leyeron'
  const algunaVencida = filas.some((f) => esVencida(f))
  const grupoAnulado = filas.every((f) => f.estado === 'anulada')
  const puedeAnular = puedeAnularGestion(usuario) && !grupoAnulado

  async function anularGrupo() {
    setAnulando(true)
    setError(null)

    const res = await fetch(`/api/gestion/grupo/${primera.grupo_id}`, {
      method: 'PATCH',
    })

    setAnulando(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo anular el grupo.')
      return
    }

    setConfirmarAnular(false)
    router.refresh()
  }

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
        <td className="px-4 py-2">{formatFecha(primera.created_at)}</td>
        <td className="px-4 py-2">{primera.fecha_limite ?? '—'}</td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAbierto((a) => !a)}
              className="text-xs text-accent hover:underline"
            >
              {abierto ? 'Ocultar detalle' : 'Ver detalle'}
            </button>

            {puedeAnular &&
              (confirmarAnular ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-gray-700">
                    ¿Anular las {total} gestiones de este grupo? Esta acción no
                    se puede deshacer.
                  </span>
                  <button
                    type="button"
                    onClick={anularGrupo}
                    disabled={anulando}
                    className="font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    {anulando ? 'Anulando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarAnular(false)}
                    disabled={anulando}
                    className="text-gray-500 hover:underline disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmarAnular(true)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Anular todo el grupo
                </button>
              ))}
          </div>
          {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
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
            <td className="px-4 py-2" colSpan={3} />
          </tr>
        ))}
    </>
  )
}
