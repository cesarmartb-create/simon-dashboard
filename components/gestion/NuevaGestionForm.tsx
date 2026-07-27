'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AdjuntosInput from '@/components/adjuntos/AdjuntosInput'
import { registrarAdjuntos } from '@/components/adjuntos/actions'
import { subirAdjuntos } from '@/lib/adjuntos'
import { TIPO_GESTION_LABEL, type TipoGestion } from '@/types/gestion'

interface Props {
  clienteId: string
  locales: { codigo: string; nombre: string }[]
}

interface RespuestaCreacion {
  ok: boolean
  creadas: number
  grupo_id: string | null
  ids: string[]
}

const TIPOS: TipoGestion[] = ['solicitud', 'memo', 'comunicado']

export default function NuevaGestionForm({ clienteId, locales }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [tipo, setTipo] = useState<TipoGestion>('solicitud')
  const [folioExterno, setFolioExterno] = useState('')
  const [destinoModo, setDestinoModo] = useState<'local' | 'todos'>('local')
  const [destinoCodigo, setDestinoCodigo] = useState(locales[0]?.codigo ?? '')
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [documento, setDocumento] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState<{ ids: string[]; aviso: string | null } | null>(
    null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    if (destinoModo === 'local' && !destinoCodigo) {
      setError('Debes seleccionar un local.')
      return
    }
    setGuardando(true)
    setError(null)

    const res = await fetch('/api/gestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        destino: destinoModo === 'todos' ? 'todos' : destinoCodigo,
        titulo: titulo.trim(),
        instrucciones: instrucciones.trim() || undefined,
        fecha_limite: fechaLimite || undefined,
        folio_externo:
          tipo === 'comunicado' ? folioExterno.trim() || undefined : undefined,
      }),
    })

    if (!res.ok) {
      setGuardando(false)
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo crear la gestión.')
      return
    }

    const data = (await res.json()) as RespuestaCreacion

    // Documento original (solo solicitud): cada fila tiene su propio
    // gestion_id/ruta en Storage, asi que se sube una vez por fila creada.
    const fallidos: string[] = []
    if (tipo === 'solicitud' && documento.length > 0) {
      for (const id of data.ids) {
        const r = await subirAdjuntos(supabase, {
          clienteId,
          entidad: 'gestion',
          entidadId: id,
          archivos: documento,
        })
        let filaFallo = r.fallidos.length > 0
        if (r.subidos.length > 0) {
          const reg = await registrarAdjuntos({
            entidad: 'gestion',
            entidadId: id,
            archivos: r.subidos,
          })
          if (!reg.ok) filaFallo = true
        }
        if (filaFallo) fallidos.push(id)
      }
    }

    setGuardando(false)

    const aviso =
      fallidos.length > 0
        ? `Se creó, pero no se pudo subir el documento en ${fallidos.length} de ${data.ids.length} fila(s). Puedes agregarlo desde el detalle.`
        : null

    if (data.ids.length === 1 && !aviso) {
      router.push(`/gestion/${data.ids[0]}`)
      router.refresh()
      return
    }

    setCreado({ ids: data.ids, aviso })
  }

  if (creado) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2">
          Se creó correctamente ({creado.ids.length} fila(s)).
        </div>
        {creado.aviso && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
            {creado.aviso}
          </div>
        )}
        <Link
          href={creado.ids.length === 1 ? `/gestion/${creado.ids[0]}` : '/gestion'}
          className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Ir a Gestión →
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-6 space-y-4 max-w-2xl"
    >
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoGestion)}
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_GESTION_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {tipo === 'comunicado' && (
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Folio externo
          </label>
          <input
            type="text"
            value={folioExterno}
            onChange={(e) => setFolioExterno(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">Destino</label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            checked={destinoModo === 'local'}
            onChange={() => setDestinoModo('local')}
            className="accent-accent"
          />
          Un local específico
        </label>
        {destinoModo === 'local' && (
          <select
            value={destinoCodigo}
            onChange={(e) => setDestinoCodigo(e.target.value)}
            className="ml-6 px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          >
            {locales.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.codigo} — {l.nombre}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            checked={destinoModo === 'todos'}
            onChange={() => setDestinoModo('todos')}
            className="accent-accent"
          />
          Todos los locales ({locales.length})
        </label>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Instrucciones
        </label>
        <textarea
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          rows={5}
          placeholder="Describe la instruccion o el contenido…"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Fecha límite (opcional)
        </label>
        <input
          type="date"
          value={fechaLimite}
          onChange={(e) => setFechaLimite(e.target.value)}
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        />
      </div>

      {tipo === 'solicitud' && (
        <AdjuntosInput
          archivos={documento}
          onChange={setDocumento}
          disabled={guardando}
          label="Documento original (opcional)"
        />
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/gestion"
          className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando || !titulo.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </form>
  )
}
