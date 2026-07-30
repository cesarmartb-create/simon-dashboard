'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import FiltroMultiple from '@/components/casos/FiltroMultiple'
import {
  TIPO_GESTION_LABEL,
  ESTADO_GESTION_LABEL,
  type TipoGestion,
  type EstadoGestion,
} from '@/types/gestion'

interface Props {
  locales: string[]
}

const TIPOS: TipoGestion[] = ['solicitud', 'memo', 'comunicado']
const ESTADOS: EstadoGestion[] = ['pendiente', 'respondida', 'leida', 'anulada']

export default function FiltrosGestion({ locales }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function actualizarMultiple(key: string, valores: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    valores.forEach((v) => params.append(key, v))
    router.push(`${pathname}?${params.toString()}`)
  }

  const tiposActuales = searchParams.getAll('tipo')
  const estadosActuales = searchParams.getAll('estado')
  const localesActuales = searchParams.getAll('local')

  const opcionesTipo = TIPOS.map((t) => ({ value: t, label: TIPO_GESTION_LABEL[t] }))
  const opcionesEstado = ESTADOS.map((e) => ({
    value: e,
    label: ESTADO_GESTION_LABEL[e],
  }))
  const opcionesLocal = locales.map((l) => ({ value: l, label: l }))

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <FiltroMultiple
        label="Tipo"
        opciones={opcionesTipo}
        seleccionados={tiposActuales}
        onChange={(v) => actualizarMultiple('tipo', v)}
      />

      <FiltroMultiple
        label="Estado"
        opciones={opcionesEstado}
        seleccionados={estadosActuales}
        onChange={(v) => actualizarMultiple('estado', v)}
      />

      <FiltroMultiple
        label="Local"
        opciones={opcionesLocal}
        seleccionados={localesActuales}
        onChange={(v) => actualizarMultiple('local', v)}
      />
    </div>
  )
}
