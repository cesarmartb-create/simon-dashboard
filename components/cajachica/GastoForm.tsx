'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { agregarGasto, editarGasto } from '@/app/(dashboard)/caja-chica/acciones-gastos'
import AdjuntosInput from '@/components/adjuntos/AdjuntosInput'
import { registrarAdjuntos } from '@/components/adjuntos/actions'
import { subirAdjuntos } from '@/lib/adjuntos'
import {
  FORMAS_PAGO,
  FORMA_PAGO_LABEL,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABEL,
  type FormaPago,
  type TipoDocumento,
} from '@/types/cajachica'
import type { GastoConTipo } from './GastosTabla'

interface TipoOpcion {
  id: string
  nombre: string
}

interface Props {
  rendicionId: string
  clienteId: string
  tipos: TipoOpcion[]
  gastoEditar?: GastoConTipo | null
  onDone?: () => void
}

export default function GastoForm({
  rendicionId,
  clienteId,
  tipos,
  gastoEditar,
  onDone,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const editando = !!gastoEditar

  const [fechaGasto, setFechaGasto] = useState('')
  const [monto, setMonto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoGastoId, setTipoGastoId] = useState('')
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('boleta')
  const [nDocumento, setNDocumento] = useState('')
  const [boleta, setBoleta] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Prefill al entrar en modo edicion (o limpiar al salir).
  useEffect(() => {
    if (gastoEditar) {
      setFechaGasto(gastoEditar.fecha_gasto?.slice(0, 10) ?? '')
      setMonto(String(gastoEditar.monto ?? ''))
      setProveedor(gastoEditar.proveedor ?? '')
      setDescripcion(gastoEditar.descripcion ?? '')
      setTipoGastoId(gastoEditar.tipo_gasto_id ?? '')
      setFormaPago(gastoEditar.forma_pago)
      setTipoDocumento(gastoEditar.tipo_documento ?? 'sin_documento')
      setNDocumento(gastoEditar.n_documento ?? '')
      setBoleta([])
      setError(null)
      setAviso(null)
    } else {
      limpiar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastoEditar?.id])

  function limpiar() {
    setFechaGasto('')
    setMonto('')
    setProveedor('')
    setDescripcion('')
    setTipoGastoId('')
    setFormaPago('efectivo')
    setTipoDocumento('boleta')
    setNDocumento('')
    setBoleta([])
    setError(null)
    setAviso(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    const montoNum = Number(monto)
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('El monto debe ser mayor que cero.')
      return
    }
    if (!fechaGasto) {
      setError('Indica la fecha del gasto.')
      return
    }

    setGuardando(true)

    const payload = {
      fechaGasto,
      monto: montoNum,
      proveedor: proveedor.trim() || null,
      descripcion: descripcion.trim() || null,
      tipoGastoId: tipoGastoId || null,
      formaPago,
      tipoDocumento,
      nDocumento: nDocumento.trim() || null,
    }

    const r = editando
      ? await editarGasto({ gastoId: gastoEditar!.id, ...payload })
      : await agregarGasto({ rendicionId, ...payload })

    if (!r.ok || !r.gastoId) {
      setGuardando(false)
      setError(r.error ?? 'No se pudo guardar el gasto.')
      return
    }

    // Boleta (opcional): se agrega al gasto (nueva o adicional). Best-effort.
    if (boleta.length > 0) {
      const sub = await subirAdjuntos(supabase, {
        clienteId,
        entidad: 'gastos',
        entidadId: r.gastoId,
        archivos: boleta,
      })
      if (sub.subidos.length > 0) {
        await registrarAdjuntos({
          entidad: 'gastos',
          entidadId: r.gastoId,
          archivos: sub.subidos,
        })
      }
      if (sub.fallidos.length > 0) {
        setAviso(`No se pudo subir la boleta: ${sub.fallidos.join(', ')}.`)
      }
    }

    setGuardando(false)
    if (editando) {
      onDone?.()
    } else {
      limpiar()
    }
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {editando ? 'Editar gasto' : 'Agregar gasto'}
        </h3>
        {editando && (
          <button
            type="button"
            onClick={() => onDone?.()}
            className="text-xs text-gray-500 hover:underline"
          >
            Cancelar edición
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Fecha del gasto
          </label>
          <input
            type="date"
            value={fechaGasto}
            onChange={(e) => setFechaGasto(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">Monto</label>
          <input
            type="number"
            min={1}
            step={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Tipo de gasto
          </label>
          <select
            value={tipoGastoId}
            onChange={(e) => setTipoGastoId(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            <option value="">Sin clasificar</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Forma de pago
          </label>
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPago)}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            {FORMAS_PAGO.map((f) => (
              <option key={f} value={f}>
                {FORMA_PAGO_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Proveedor (opcional)
          </label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="A quién se le pagó"
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Tipo de documento
          </label>
          <select
            value={tipoDocumento}
            onChange={(e) => {
              const v = e.target.value as TipoDocumento
              setTipoDocumento(v)
              if (v === 'sin_documento') setNDocumento('')
            }}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            {TIPOS_DOCUMENTO.map((td) => (
              <option key={td} value={td}>
                {TIPO_DOCUMENTO_LABEL[td]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          {tipoDocumento === 'sin_documento'
            ? 'N° documento'
            : 'N° documento (opcional)'}
        </label>
        <input
          type="text"
          value={nDocumento}
          onChange={(e) => setNDocumento(e.target.value)}
          disabled={tipoDocumento === 'sin_documento'}
          placeholder={
            tipoDocumento === 'sin_documento'
              ? 'Sin documento'
              : 'N° boleta / factura'
          }
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent disabled:bg-gray-100 disabled:text-gray-400"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Descripción (opcional)
        </label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle del gasto"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          {editando ? 'Agregar otra boleta (opcional)' : 'Boleta (opcional)'}
        </label>
        <AdjuntosInput archivos={boleta} onChange={setBoleta} disabled={guardando} />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
      {aviso && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          {aviso}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando
            ? 'Guardando…'
            : editando
              ? 'Guardar cambios'
              : 'Agregar gasto'}
        </button>
      </div>
    </form>
  )
}
