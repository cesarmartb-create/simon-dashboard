import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notificarRecordatorioCajaChica } from '@/lib/notificar'

const CESAR = 'cesar.martinez@grupobaco.cl'

function esValido(email: string | null | undefined): email is string {
  return typeof email === 'string' && email.includes('@')
}

/**
 * Cron de recordatorio de fin de mes. Lo dispara Cron-job.org (o similar) el
 * ultimo dia del mes, con el secreto en Authorization: Bearer <CRON_SECRET>
 * (o ?secret=). Envia "rinde tu caja chica" a cada unidad con fondo o con
 * borrador abierto.
 *
 * Guard interno de ultimo dia (bypass con ?force=1) para que un disparo diario
 * tambien sea seguro. La VALIDACION del secreto ocurre ANTES de crear el
 * cliente service role o tocar datos.
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

  // 2) Guard de ultimo dia del mes (salvo ?force=1).
  const force = url.searchParams.get('force') === '1'
  const hoy = new Date()
  const manana = new Date(hoy)
  manana.setDate(hoy.getDate() + 1)
  const esUltimoDia = manana.getMonth() !== hoy.getMonth()
  if (!esUltimoDia && !force) {
    return NextResponse.json({ ok: true, skipped: 'no es ultimo dia del mes' })
  }

  // 3) Service role (bypassa RLS) — recien ahora, ya autenticado el cron.
  const svc = createServiceClient()

  const { data: fondos } = await svc
    .from('fondos_caja_chica')
    .select('cliente_id, local')
    .eq('activo', true)

  const { data: borradores } = await svc
    .from('rendiciones_caja_chica')
    .select('cliente_id, local')
    .eq('estado', 'abierto')

  // Unidades a notificar: (cliente_id, local) con fondo o con borrador abierto.
  const unidades = new Map<
    string,
    { cliente_id: string; local: string; tieneFondo: boolean; tieneBorrador: boolean }
  >()
  const clave = (c: string, l: string) => `${c}|${l}`
  for (const f of fondos ?? []) {
    const k = clave(f.cliente_id as string, f.local as string)
    unidades.set(k, {
      cliente_id: f.cliente_id as string,
      local: f.local as string,
      tieneFondo: true,
      tieneBorrador: false,
    })
  }
  for (const b of borradores ?? []) {
    const k = clave(b.cliente_id as string, b.local as string)
    const prev = unidades.get(k)
    if (prev) prev.tieneBorrador = true
    else
      unidades.set(k, {
        cliente_id: b.cliente_id as string,
        local: b.local as string,
        tieneFondo: false,
        tieneBorrador: true,
      })
  }

  // Correo por local (fuente primaria): locales.correo, key por codigo.
  const clientes = Array.from(new Set([...unidades.values()].map((u) => u.cliente_id)))
  const correoPorCodigo = new Map<string, string | null>()
  if (clientes.length > 0) {
    const { data: locales } = await svc
      .from('locales')
      .select('cliente_id, codigo, correo')
      .in('cliente_id', clientes)
    for (const l of locales ?? []) {
      correoPorCodigo.set(
        clave(l.cliente_id as string, (l.codigo as string).trim()),
        (l.correo as string | null) ?? null
      )
    }
  }

  const enviados: string[] = []
  const sinCorreo: string[] = []

  for (const u of unidades.values()) {
    const codigo = u.local.split(' — ')[0].trim()

    // Prioridad: locales.correo -> local_correo de la rendicion mas reciente -> Cesar.
    let correo: string | null = correoPorCodigo.get(clave(u.cliente_id, codigo)) ?? null
    if (!esValido(correo)) {
      const { data: ultima } = await svc
        .from('rendiciones_caja_chica')
        .select('local_correo')
        .eq('cliente_id', u.cliente_id)
        .eq('local', u.local)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ local_correo: string | null }>()
      correo = ultima?.local_correo ?? null
    }

    const sinCorreoConfigurado = !esValido(correo)
    const destino = sinCorreoConfigurado ? CESAR : (correo as string)
    if (sinCorreoConfigurado) sinCorreo.push(u.local)

    await notificarRecordatorioCajaChica(destino, u.local, {
      sinCorreoConfigurado,
    })
    enviados.push(u.local)
  }

  return NextResponse.json({
    ok: true,
    unidades: unidades.size,
    enviados: enviados.length,
    sin_correo: sinCorreo,
  })
}
