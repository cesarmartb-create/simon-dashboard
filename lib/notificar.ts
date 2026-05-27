import { emailsPorRol, getUsuario, emailPorNombre } from '@/lib/auth'

const SIMON_URL = 'https://simon-62wy.onrender.com/notificar-colaborador'
const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send'

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface NotificarPayload {
  numero: string | null
  nombre: string | null
  estado: string
}

interface CasoCorreo {
  id: string
  colaborador_nombre: string | null
  local: string | null
  categoria: string | null
  consulta: string | null
  responsable: string | null
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

// --- Correos de caso (SendGrid) ---

function temaDe(caso: CasoCorreo): string {
  return caso.categoria?.trim() || caso.consulta?.trim() || 'Sin tema'
}

/** "Nombre (email)" si el usuario está registrado; si no, solo el email. */
function nombreYEmail(email: string): string {
  const u = getUsuario(email)
  return u ? `${u.nombre} (${email})` : email
}

function linkCaso(id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${baseUrl}/casos/${id}`
}

function construirHtmlCaso(opts: {
  titulo: string
  headerColor: string
  intro: string
  filas: [string, string][]
  link: string
}): string {
  const filasHtml = opts.filas
    .map(([etiqueta, valor], i) => {
      const fondo = i % 2 === 0 ? '#ffffff' : '#f5f5f7'
      return `<tr style="background-color:${fondo};">
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;width:160px;vertical-align:top;border-bottom:1px solid #ececf0;">${escapeHtml(etiqueta)}</td>
        <td style="padding:10px 16px;font-size:14px;color:#111827;border-bottom:1px solid #ececf0;">${escapeHtml(valor)}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e7eb;max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${opts.headerColor};padding:20px 24px;">
              <span style="color:#ffffff;font-size:18px;font-weight:600;">${escapeHtml(opts.titulo)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#374151;">
                ${escapeHtml(opts.intro)}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececf0;border-collapse:collapse;">
                ${filasHtml}
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background-color:#2563EB;">
                    <a href="${escapeHtml(opts.link)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Ver el caso &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f5f5f7;padding:16px 24px;border-top:1px solid #ececf0;">
              <span style="font-size:12px;color:#9ca3af;">Generado por Simón</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function enviarCorreoCaso(opts: {
  destinatarios: string[]
  subject: string
  texto: string
  html: string
  contexto: string
}): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.error(
      `[notificar] SENDGRID_API_KEY o EMAIL_FROM no configurados; se omite el correo de ${opts.contexto}`
    )
    return
  }
  if (opts.destinatarios.length === 0) {
    console.error(
      `[notificar] No hay destinatarios para el correo de ${opts.contexto}`
    )
    return
  }

  try {
    const res = await fetch(SENDGRID_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          { to: opts.destinatarios.map((email) => ({ email })) },
        ],
        from: { email: from },
        subject: opts.subject,
        // text/plain antes que text/html, como exige SendGrid.
        content: [
          { type: 'text/plain', value: opts.texto },
          { type: 'text/html', value: opts.html },
        ],
      }),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      console.error(
        `[notificar] SendGrid respondió ${res.status} (${opts.contexto}): ${detalle}`
      )
    }
  } catch (err) {
    console.error(`[notificar] Error enviando correo de ${opts.contexto}:`, err)
  }
}

/**
 * Notifica por correo a admins y supervisores cuando un caso se escala.
 * Nunca lanza: cualquier error se loguea y se descarta para no bloquear al usuario.
 */
export async function notificarEscalado(
  caso: CasoCorreo,
  observacion: string,
  emailGestor: string
): Promise<void> {
  const destinatarios = Array.from(
    new Set([...emailsPorRol('admin'), ...emailsPorRol('supervisor')])
  )

  const tema = temaDe(caso)
  const colaborador = caso.colaborador_nombre ?? '—'
  const local = caso.local ?? '—'
  const escaladoPor = nombreYEmail(emailGestor)
  const link = linkCaso(caso.id)

  const filas: [string, string][] = [
    ['Colaborador', colaborador],
    ['Local', local],
    ['Tema', tema],
    ['Observación', observacion],
    ['Escalado por', escaladoPor],
  ]

  const texto = [
    'Se ha escalado un caso y requiere tu atención.',
    '',
    `Colaborador: ${colaborador}`,
    `Local: ${local}`,
    `Tema: ${tema}`,
    `Observación: ${observacion}`,
    `Escalado por: ${escaladoPor}`,
    '',
    `Ver el caso: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Caso escalado',
    headerColor: '#1E1E2E',
    intro: 'Se ha escalado un caso y requiere tu atención.',
    filas,
    link,
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Caso escalado: ${tema}`,
    texto,
    html,
    contexto: 'escalamiento',
  })
}

/**
 * Notifica por correo a admins, supervisores y al responsable cuando un caso se cierra.
 * Nunca lanza: cualquier error se loguea y se descarta para no bloquear al usuario.
 */
export async function notificarCierre(
  caso: CasoCorreo,
  observacion: string,
  emailGestor: string
): Promise<void> {
  const emailResponsable = emailPorNombre(caso.responsable)
  const destinatarios = Array.from(
    new Set([
      ...emailsPorRol('admin'),
      ...emailsPorRol('supervisor'),
      ...(emailResponsable ? [emailResponsable] : []),
    ])
  )

  const tema = temaDe(caso)
  const colaborador = caso.colaborador_nombre ?? '—'
  const local = caso.local ?? '—'
  const cerradoPor = nombreYEmail(emailGestor)
  const link = linkCaso(caso.id)

  const filas: [string, string][] = [
    ['Colaborador', colaborador],
    ['Local', local],
    ['Tema', tema],
    ['Observación', observacion],
    ['Cerrado por', cerradoPor],
  ]

  const texto = [
    'Un caso ha sido cerrado.',
    '',
    `Colaborador: ${colaborador}`,
    `Local: ${local}`,
    `Tema: ${tema}`,
    `Observación: ${observacion}`,
    `Cerrado por: ${cerradoPor}`,
    '',
    `Ver el caso: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Caso cerrado',
    headerColor: '#16a34a',
    intro: 'Un caso ha sido cerrado.',
    filas,
    link,
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Caso cerrado: ${tema}`,
    texto,
    html,
    contexto: 'cierre',
  })
}
