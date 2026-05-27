import { emailsPorRol } from '@/lib/auth'

const SIMON_URL = 'https://simon-62wy.onrender.com/notificar-colaborador'
const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send'

interface NotificarPayload {
  numero: string | null
  nombre: string | null
  estado: string
}

interface CasoEscalado {
  id: string
  colaborador_nombre: string | null
  local: string | null
  categoria: string | null
  consulta: string | null
}

/**
 * Notifica al colaborador a través del endpoint de Simón.
 * Nunca lanza: cualquier error se loguea y se descarta para no bloquear al usuario.
 */
export async function notificarColaborador(
  payload: NotificarPayload
): Promise<void> {
  const secret = process.env.SIMON_NOTIFICAR_SECRET
  if (!secret) {
    console.error(
      '[notificar] SIMON_NOTIFICAR_SECRET no está configurado; se omite la notificación'
    )
    return
  }

  try {
    const res = await fetch(SIMON_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret,
      },
      body: JSON.stringify({
        numero: payload.numero,
        nombre: payload.nombre,
        estado: payload.estado,
      }),
    })

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      console.error(`[notificar] Simón respondió ${res.status}: ${cuerpo}`)
    }
  } catch (err) {
    console.error('[notificar] Error llamando al endpoint de Simón:', err)
  }
}

/**
 * Notifica por correo (SendGrid) a admins y supervisores cuando un caso se escala.
 * Nunca lanza: cualquier error se loguea y se descarta para no bloquear al usuario.
 */
export async function notificarEscalado(
  caso: CasoEscalado,
  observacion: string,
  emailGestor: string
): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.error(
      '[notificar] SENDGRID_API_KEY o EMAIL_FROM no configurados; se omite el correo de escalamiento'
    )
    return
  }

  const destinatarios = Array.from(
    new Set([...emailsPorRol('admin'), ...emailsPorRol('supervisor')])
  )
  if (destinatarios.length === 0) {
    console.error('[notificar] No hay destinatarios admin/supervisor para el escalamiento')
    return
  }

  const tema = caso.categoria?.trim() || caso.consulta?.trim() || 'Sin tema'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const link = `${baseUrl}/casos/${caso.id}`

  const cuerpo = [
    'Se ha escalado un caso y requiere tu atención.',
    '',
    `Colaborador: ${caso.colaborador_nombre ?? '—'}`,
    `Local: ${caso.local ?? '—'}`,
    `Tema: ${tema}`,
    `Observación: ${observacion}`,
    `Escalado por: ${emailGestor}`,
    '',
    `Ver el caso: ${link}`,
  ].join('\n')

  try {
    const res = await fetch(SENDGRID_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          { to: destinatarios.map((email) => ({ email })) },
        ],
        from: { email: from },
        subject: `Caso escalado: ${tema}`,
        content: [{ type: 'text/plain', value: cuerpo }],
      }),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      console.error(`[notificar] SendGrid respondió ${res.status}: ${detalle}`)
    }
  } catch (err) {
    console.error('[notificar] Error enviando correo de escalamiento:', err)
  }
}
