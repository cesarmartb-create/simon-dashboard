'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { crearCaso } from '@/app/(dashboard)/casos/nuevo/actions'
import AdjuntosInput from '@/components/adjuntos/AdjuntosInput'
import {
  registrarAdjuntos,
  notificarCasoCreado,
} from '@/components/adjuntos/actions'
import { subirAdjuntos } from '@/lib/adjuntos'

interface Props {
  clienteId: string
  local: string
}

const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
  { value: 'prevencion_riesgos', label: 'Prevención de Riesgos' },
  { value: 'sensible', label: 'Sensible' },
  { value: 'accidente', label: 'Accidente' },
]

export default function NuevaSolicitudForm({ clienteId, local }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [categoria, setCategoria] = useState(CATEGORIAS[0].value)
  const [consulta, setConsulta] = useState('')
  const [colaboradorNombre, setColaboradorNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qfs, setQfs] = useState<{ nombre: string }[]>([])
  const [reportadoPor, setReportadoPor] = useState('')
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  const [creado, setCreado] = useState<{ id: string; fallidos: string[] } | null>(
    null
  )

  const localCodigo = local.split(' — ')[0].trim()

  useEffect(() => {
    if (!localCodigo) return
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
  }, [localCodigo])

  const perfilIncompleto = !clienteId || !local

  if (perfilIncompleto) {
    return (
      <div className="max-w-2xl">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          Tu perfil no tiene cliente o local asignados. Contacta al
          administrador para poder crear solicitudes.
        </div>
        <div className="mt-4">
          <Link
            href="/casos"
            className="text-sm text-gray-500 hover:text-accent transition-colors"
          >
            ← Volver a casos
          </Link>
        </div>
      </div>
    )
  }

  if (creado) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2">
          El caso se creó correctamente.
        </div>
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          No se pudieron subir estos archivos: {creado.fallidos.join(', ')}.
          Puedes intentar agregarlos de nuevo desde el detalle del caso.
        </div>
        <Link
          href={`/casos/${creado.id}`}
          className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Ir al caso →
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consulta.trim()) return
    if (!reportadoPor) {
      setError('Debes seleccionar quién reporta.')
      return
    }
    setGuardando(true)
    setError(null)

    const resultado = await crearCaso({
      categoria,
      consulta: consulta.trim(),
      reportadoPor,
      colaboradorNombre: colaboradorNombre.trim() || null,
    })

    if (!resultado.ok || !resultado.casoId) {
      setGuardando(false)
      setError(resultado.error ?? 'No se pudo crear el caso.')
      return
    }

    const casoId = resultado.casoId

    // Subir adjuntos (si hay) despues de crear el caso. Si algo falla, el caso
    // ya existe y no se bloquea: se acumulan los archivos que no se pudieron subir.
    let fallidos: string[] = []
    if (adjuntos.length > 0) {
      const r = await subirAdjuntos(supabase, {
        clienteId,
        entidad: 'casos',
        entidadId: casoId,
        archivos: adjuntos,
      })
      fallidos = r.fallidos
      if (r.subidos.length > 0) {
        const reg = await registrarAdjuntos({
          entidad: 'casos',
          entidadId: casoId,
          archivos: r.subidos,
        })
        if (!reg.ok) fallidos = adjuntos.map((f) => f.name)
      }
    }

    // El correo sale SIEMPRE una vez creado el caso, con el conteo real de
    // adjuntos registrados (aunque sea 0). Best-effort: un error de red no
    // debe impedir continuar al detalle.
    try {
      await notificarCasoCreado(casoId)
    } catch {
      // el correo es best-effort; el caso ya quedo creado
    }

    setGuardando(false)

    if (fallidos.length > 0) {
      setCreado({ id: casoId, fallidos })
      return
    }

    router.push(`/casos/${casoId}`)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-6 space-y-4 max-w-2xl"
    >
      <div className="text-sm text-gray-500">
        El caso quedará asociado a tu local (<strong>{local}</strong>).
      </div>

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
          Categoría
        </label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          required
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Consulta
        </label>
        <textarea
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          required
          rows={6}
          placeholder="Describe la solicitud o consulta…"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent resize-none"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 mb-1">
          Colaborador afectado (opcional)
        </label>
        <input
          type="text"
          value={colaboradorNombre}
          onChange={(e) => setColaboradorNombre(e.target.value)}
          placeholder="Nombre del colaborador, si aplica"
          className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
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
          href="/casos"
          className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando || !consulta.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {guardando ? 'Creando…' : 'Crear solicitud'}
        </button>
      </div>
    </form>
  )
}
