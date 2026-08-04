import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notificarRecordatorioGestion } from '@/lib/notificar'
import { hoyChile } from '@/lib/utils'
import type { Gestion } from '@/types/gestion'

function esValido(email: string | null | undefined): email is string {
  return typeof email === 'string' && email.includes('@')
}

/**
 * Cron de recordatorio de plazos de gestion. Lo dispara Cron-job.org (o
 * similar) a diario, con el secreto en Authorization: Bearer <CRON_SECRET>
 * (o ?secret=). Avisa al local cuando una gestion pendiente cumple o vencio
 * su plazo. El candado ultimo_recordatorio IS NULL asegura un solo aviso por
 * gestion; si el cron falla un dia, la fila sigue calificando al dia siguiente.
 *
 * Soporta ?dry=1 para simular la corrida sin enviar correos ni tocar datos.
 */
export async function GET(request: Request) {
  // 1) Autenticacion del cron: cortar aqui si no coincide.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado' },
      { status: 500 }
    )
  }
  const url = new URL(request.url)
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  const provided =
    bearer ||
    request.headers.get('x-cron-secret') ||
    url.searchParams.get('secret') ||
    ''
  if (provided !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dry = url.searchParams.get('dry') === '1'

  // 2) Service role (bypassa RLS) — recien ahora, ya autenticado el cron.
  const svc = createServiceClient()
  const hoy = hoyChile()

  const { data } = await svc
    .from('gestion')
    .select('*')
    .eq('estado', 'pendiente')
    .lte('fecha_limite', hoy)
    .is('ultimo_recordatorio', null)
    .returns<Gestion[]>()

  const gestiones = data ?? []

  const grupos = new Map<string, Gestion[]>()
  for (const g of gestiones) {
    const clave = `${g.cliente_id}|${g.local}`
    const lista = grupos.get(clave)
    if (lista) lista.push(g)
    else grupos.set(clave, [g])
  }

  // Correo por local (fuente secundaria): locales.correo, key por codigo.
  const clientes = Array.from(new Set(gestiones.map((g) => g.cliente_id)))
  const correoPorCodigo = new Map<string, string | null>()
  if (clientes.length > 0) {
    const { data: locales } = await svc
      .from('locales')
      .select('cliente_id, codigo, correo')
      .in('cliente_id', clientes)
    for (const l of locales ?? []) {
      correoPorCodigo.set(
        `${l.cliente_id}|${(l.codigo as string).trim()}`,
        (l.correo as string | null) ?? null
      )
    }
  }

  const ahora = new Date().toISOString()
  let enviados = 0
  const fallidos: string[] = []
  const sinCorreo: string[] = []
  const simulados: { local: string; correo: string; gestiones: string[] }[] = []

  for (const grupo of grupos.values()) {
    const clienteId = grupo[0].cliente_id
    const local = grupo[0].local

    // Prioridad: local_correo del grupo -> locales.correo por codigo. Nunca cae
    // a un fallback como Cesar: este aviso va solo al local.
    let correo: string | null =
      grupo.find((g) => esValido(g.local_correo))?.local_correo ?? null
    if (!esValido(correo)) {
      const codigo = local.split(' — ')[0].trim()
      correo = correoPorCodigo.get(`${clienteId}|${codigo}`) ?? null
    }

    if (!esValido(correo)) {
      sinCorreo.push(local)
      continue
    }

    if (dry) {
      simulados.push({
        local,
        correo,
        gestiones: grupo.map((g) => g.titulo),
      })
      continue
    }

    const ok = await notificarRecordatorioGestion({
      localCorreo: correo,
      local,
      gestiones: grupo,
    })

    if (ok) {
      enviados++
      const ids = grupo.map((g) => g.id)

      const { error: errorUpdate } = await svc
        .from('gestion')
        .update({ ultimo_recordatorio: ahora })
        .in('id', ids)
      if (errorUpdate) {
        console.error(
          '[gestion/recordatorio] Error actualizando ultimo_recordatorio:',
          errorUpdate
        )
      }

      for (const g of grupo) {
        const { error: errorEvento } = await svc.from('eventos').insert({
          gestion_id: g.id,
          tipo: 'recordatorio',
          actor: 'sistema',
          fecha: ahora,
          detalle: `Aviso de plazo enviado a ${correo}`,
        })
        if (errorEvento) {
          console.error(
            '[gestion/recordatorio] Error insertando evento:',
            errorEvento
          )
        }
      }
    } else {
      // No se toca nada de este grupo: reintenta en la siguiente corrida.
      fallidos.push(local)
    }
  }

  return NextResponse.json({
    ok: true,
    hoy,
    dry,
    grupos: grupos.size,
    gestiones: gestiones.length,
    enviados,
    fallidos,
    sin_correo: sinCorreo,
    ...(dry ? { simulados } : {}),
  })
}
