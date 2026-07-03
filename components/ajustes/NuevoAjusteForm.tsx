'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { crearAjuste } from '@/app/(dashboard)/ajustes/nuevo/actions'
import AdjuntosInput from '@/components/adjuntos/AdjuntosInput'
import {
  registrarAdjuntos,
  notificarAjusteCreado,
} from '@/components/adjuntos/actions'
import { subirAdjuntos } from '@/lib/adjuntos'
import type { DireccionAjuste } from '@/types/ajuste'

interface TipoOpcion {
  id: string
  codigo: string
  nombre: string
}

interface Props {
  esAdmin: boolean
  localFijo: string | null
  locales: string[]
  tipos: TipoOpcion[]
}

export default function NuevoAjusteForm({
  esAdmin,
  localFijo,
  locales,
  tipos,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [local, setLocal] = useState(localFijo ?? '')
  const [reportadoPor, setReportadoPor] = useState('')
  const [qfs, setQfs] = useState<{ nombre: string }[]>([])
  const [tipoId, setTipoId] = useState('')
  const [direccion, setDireccion] = useState<'' | DireccionAjuste>('')
  const [cantidadSku, setCantidadSku] = useState('')
  const [monto, setMonto] = useState('')
  const [folioOrigen, setFolioOrigen] = useState('')
  const [folioReferencia, setFolioReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  const [creado, setCreado] = useState<{ id: string; fallidos: string[] } | null>(
    null
  )

  const localCodigo = local.split(' — ')[0].trim()

  useEffect(() => {
    setReportadoPor('')
    if (!localCodigo) {
      setQfs([])
      return
    }
    supabase
      .from('colaboradores')
      .select('nombre')
      .eq('local', localCodigo)
      .eq('cargo', localCodigo === 'OFICINA' ? 'gerente_comercial' : 'jefe_de_local_quimico_farmaceutico')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) setQfs(data)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCodigo])

  const tipoSeleccionado = tipos.find((t) => t.id === tipoId)
  const esRectificacion = tipoSeleccionado?.codigo === 'rectificacion'

  const perfilIncompleto = !esAdmin && !localFijo

  if (perfilIncompleto) {
    return (
      <div className="max-w-2xl">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          Tu perfil no tiene local asignado. Contacta al administrador para
          poder crear ajustes.
        </div>
        <div className="mt-4">
          <Link
            href="/ajustes"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a ajustes
          </Link>
        </div>
      </div>
    )
  }

  if (creado) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2">
          El ajuste se creó correctamente.
        </div>
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          No se pudieron subir estos archivos: {creado.fallidos.join(', ')}.
          Puedes intentar agregarlos de nuevo desde el detalle del ajuste.
        </div>
        <Link
          href={`/ajustes/${creado.id}`}
          className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Ir al ajuste →
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!local) {
      setError('Selecciona el local.')
      return
    }
    if (!reportadoPor) {
      setError('Debes seleccionar quién reporta.')
      return
    }
    if (!tipoId) {
      setError('Selecciona el tipo de ajuste.')
      return
    }
    if (!direccion) {
      setError('Selecciona la dirección del ajuste.')
      return
    }
    const cantidad = parseInt(cantidadSku, 10)
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setError('La cantidad de SKU debe ser un entero positivo.')
      return
    }
    let montoNum: number | null = null
    if (monto.trim() !== '') {
      montoNum = Number(monto)
      if (isNaN(montoNum) || montoNum < 0) {
        setError('El monto debe ser un número positivo.')
        return
      }
    }

    setGuardando(true)

    const resultado = await crearAjuste({
      local,
      reportadoPor,
      tipoId,
      direccion,
      cantidadSku: cantidad,
      monto: montoNum,
      folioOrigen: folioOrigen.trim() || null,
      folioReferencia: folioReferencia.trim() || null,
      observacion: observacion.trim() || null,
    })

    if (!resultado.ok || !resultado.ajusteId) {
      setGuardando(false)
      setError(resultado.error ?? 'No se pudo crear el ajuste.')
      return
    }

    const ajusteId = resultado.ajusteId
    const clienteId = resultado.clienteId ?? ''

    // Subir adjuntos (si hay) despues de crear el ajuste. Si algo falla, el
    // ajuste ya existe y no se bloquea: se acumulan los archivos que fallaron.
    let fallidos: string[] = []
    if (adjuntos.length > 0 && clienteId) {
      const r = await subirAdjuntos(supabase, {
        clienteId,
        entidad: 'ajustes',
        entidadId: ajusteId,
        archivos: adjuntos,
      })
      fallidos = r.fallidos
      if (r.subidos.length > 0) {
        const reg = await registrarAdjuntos({
          entidad: 'ajustes',
          entidadId: ajusteId,
          archivos: r.subidos,
        })
        if (!reg.ok) fallidos = adjuntos.map((f) => f.name)
      }
    }

    // El correo sale SIEMPRE una vez creado el ajuste, con el conteo real de
    // adjuntos registrados (aunque sea 0). Best-effort: un error de red no
    // debe impedir continuar al detalle.
    try {
      await notificarAjusteCreado(ajusteId)
    } catch {
      // el correo es best-effort; el ajuste ya quedo creado
    }

    setGuardando(false)

    if (fallidos.length > 0) {
      setCreado({ id: ajusteId, fallidos })
      return
    }

    router.push(`/ajustes/${ajusteId}`)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-6 space-y-4 max-w-2xl"
    >
      {esAdmin ? (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Local
          </label>
          <select
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            <option value="" disabled>
              Selecciona el local…
            </option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          El ajuste quedará asociado a tu local (<strong>{local}</strong>).
        </div>
      )}

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          ¿Quién reporta?
        </label>
        <select
          value={reportadoPor}
          onChange={(e) => setReportadoPor(e.target.value)}
          required
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="" disabled>
            Selecciona tu nombre…
          </option>
          {qfs.map((q) => (
            <option key={q.nombre} value={q.nombre}>
              {q.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Tipo de ajuste
        </label>
        <select
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          required
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          <option value="" disabled>
            Selecciona el tipo…
          </option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Dirección
        </label>
        <div className="flex gap-6 py-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="direccion"
              value="alta"
              checked={direccion === 'alta'}
              onChange={() => setDireccion('alta')}
            />
            Alta (suma inventario)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="direccion"
              value="baja"
              checked={direccion === 'baja'}
              onChange={() => setDireccion('baja')}
            />
            Baja (resta inventario)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Cantidad de SKU
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={cantidadSku}
            onChange={(e) => setCantidadSku(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Monto (opcional)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="El signo lo da la dirección"
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Folio de origen (opcional)
        </label>
        <input
          type="text"
          value={folioOrigen}
          onChange={(e) => setFolioOrigen(e.target.value)}
          placeholder="Documento que origina el ajuste (One Bit / SAP)"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      {esRectificacion && (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Folio de referencia (opcional)
          </label>
          <input
            type="text"
            value={folioReferencia}
            onChange={(e) => setFolioReferencia(e.target.value)}
            placeholder="Folio del ajuste que se corrige"
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Observación (opcional)
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={4}
          placeholder="Contexto o detalle del ajuste…"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
        />
      </div>

      <AdjuntosInput
        archivos={adjuntos}
        onChange={setAdjuntos}
        disabled={guardando}
      />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/ajustes"
          className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Creando…' : 'Crear ajuste'}
        </button>
      </div>
    </form>
  )
}
