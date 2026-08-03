'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { Gestion } from '@/types/gestion'
import { TIPO_GESTION_LABEL, ESTADO_GESTION_LABEL, esVencida } from '@/types/gestion'
import type { Usuario } from '@/types/usuario'
import { formatFecha } from '@/lib/utils'
import GestionGrupoFila from './GestionGrupoFila'

interface Props {
  filas: Gestion[]
  usuario: Usuario
}

interface Item {
  key: string
  individual?: Gestion
  grupo?: Gestion[]
}

export default function GestionTabla({ filas, usuario }: Props) {
  const items = useMemo<Item[]>(() => {
    const grupos = new Map<string, Gestion[]>()
    const individuales: Gestion[] = []

    for (const f of filas) {
      if (f.grupo_id) {
        const arr = grupos.get(f.grupo_id) ?? []
        arr.push(f)
        grupos.set(f.grupo_id, arr)
      } else {
        individuales.push(f)
      }
    }

    const resultado: Item[] = individuales.map((f) => ({ key: f.id, individual: f }))
    for (const [grupoId, arr] of grupos) {
      resultado.push({ key: grupoId, grupo: arr })
    }

    resultado.sort((a, b) => {
      const fa = a.individual ?? a.grupo![0]
      const fb = b.individual ?? b.grupo![0]
      return fb.created_at.localeCompare(fa.created_at)
    })

    return resultado
  }, [filas])

  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No hay gestiones registradas.
      </div>
    )
  }

  return (
    <table className="w-full text-sm bg-white border border-gray-200">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
          <th className="px-4 py-2 font-medium">Tipo</th>
          <th className="px-4 py-2 font-medium">Título</th>
          <th className="px-4 py-2 font-medium">Local</th>
          <th className="px-4 py-2 font-medium">Estado</th>
          <th className="px-4 py-2 font-medium">Enviado</th>
          <th className="px-4 py-2 font-medium">Fecha límite</th>
          <th className="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) =>
          item.grupo ? (
            <GestionGrupoFila key={item.key} filas={item.grupo} usuario={usuario} />
          ) : (
            <FilaIndividual key={item.key} fila={item.individual!} />
          )
        )}
      </tbody>
    </table>
  )
}

function FilaIndividual({ fila }: { fila: Gestion }) {
  const vencida = esVencida(fila)
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2">{TIPO_GESTION_LABEL[fila.tipo]}</td>
      <td className="px-4 py-2">
        <Link href={`/gestion/${fila.id}`} className="text-accent hover:underline">
          {fila.titulo}
        </Link>
      </td>
      <td className="px-4 py-2">{fila.local}</td>
      <td className="px-4 py-2">
        {ESTADO_GESTION_LABEL[fila.estado]}
        {vencida && (
          <span className="ml-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
            Vencida
          </span>
        )}
      </td>
      <td className="px-4 py-2">{formatFecha(fila.created_at)}</td>
      <td className="px-4 py-2">{fila.fecha_limite ?? '—'}</td>
      <td className="px-4 py-2">{fila.folio_externo ?? ''}</td>
    </tr>
  )
}
