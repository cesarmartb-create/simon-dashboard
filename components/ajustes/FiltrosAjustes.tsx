'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import FiltroMultiple from '@/components/casos/FiltroMultiple'
import { ESTADOS_AJUSTE, ESTADO_AJUSTE_LABEL } from '@/types/ajuste'

interface Props {
  puedeFiltrarLocal: boolean
  tipos: { id: string; nombre: string }[]
  locales: string[]
}

export default function FiltrosAjustes({
  puedeFiltrarLocal,
  tipos,
  locales,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function actualizarMultiple(key: string, valores: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    valores.forEach((v) => params.append(key, v))
    router.push(`${pathname}?${params.toString()}`)
  }

  const estadosActuales = searchParams.getAll('estado')
  const tiposActuales = searchParams.getAll('tipo')
  const localesActuales = searchParams.getAll('local')

  const opcionesEstado = ESTADOS_AJUSTE.map((e) => ({
    value: e,
    label: ESTADO_AJUSTE_LABEL[e],
  }))
  const opcionesTipo = tipos.map((t) => ({ value: t.id, label: t.nombre }))
  const opcionesLocal = locales.map((l) => ({ value: l, label: l }))

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <FiltroMultiple
        label="Estado"
        opciones={opcionesEstado}
        seleccionados={estadosActuales}
        onChange={(v) => actualizarMultiple('estado', v)}
      />

      <FiltroMultiple
        label="Tipo"
        opciones={opcionesTipo}
        seleccionados={tiposActuales}
        onChange={(v) => actualizarMultiple('tipo', v)}
      />

      {puedeFiltrarLocal && (
        <FiltroMultiple
          label="Local"
          opciones={opcionesLocal}
          seleccionados={localesActuales}
          onChange={(v) => actualizarMultiple('local', v)}
        />
      )}
    </div>
  )
}
