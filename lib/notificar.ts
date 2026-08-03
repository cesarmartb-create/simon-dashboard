import { emailsPorRol, getUsuario } from '@/lib/auth'
import { formatCLP, formatFecha } from '@/lib/utils'
import {
  ESTADO_RENDICION_LABEL,
  type EstadoRendicion,
} from '@/types/cajachica'
import { TIPO_GESTION_LABEL, type Gestion } from '@/types/gestion'

const SIMON_URL = 'https://simon-62wy.onrender.com/notificar-colaborador'
const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send'

// Copia permanente de TODAS las notificaciones del sistema (casos y ajustes).
// No incluye a los destinatarios por area ni a los correos de los locales.
const COPIA_PERMANENTE = [
  'cesar.martinez@grupobaco.cl',
  'julia.salazar@grupobaco.cl',
]

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
  local_correo?: string | null
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
  linkTexto?: string
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
                    <a href="${escapeHtml(opts.link)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(opts.linkTexto ?? 'Ver el caso')} &rarr;</a>
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
  // Helmuth sigue fuera de los correos de escalamiento (acordado en piloto).
  const EXCLUIR = ['helmuth@grupobaco.cl']
  const destinatarios = Array.from(new Set(emailsPorRol('admin')))
    .filter((e) => !EXCLUIR.includes(e))

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
  // El cierre se notifica a la copia permanente, al responsable del area
  // y al correo del local que genero el caso (solo casos del dashboard).
  // El filtro @ descarta valores null o que no sean correo (no romper SendGrid).
  const correos = [
    ...COPIA_PERMANENTE,
    caso.responsable,
    caso.local_correo,
  ].filter((e): e is string => typeof e === 'string' && e.includes('@'))
  const destinatarios = Array.from(new Set(correos))

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

/**
 * Notifica por correo cuando entra una solicitud nueva desde el portal web.
 * Destinatarios: el responsable del área (si existe) + copia permanente.
 * Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarNuevoCaso(
  caso: CasoCorreo,
  reportadoPor: string | null,
  responsableCorreo: string | null,
  numAdjuntos = 0
): Promise<void> {
  const destinatarios = Array.from(
    new Set([
      ...COPIA_PERMANENTE,
      ...(responsableCorreo ? [responsableCorreo] : []),
    ])
  )

  const tema = temaDe(caso)
  const local = caso.local ?? '—'
  const reporta = reportadoPor ?? '—'
  const link = linkCaso(caso.id)
  const sinResponsable = !responsableCorreo

  const filas: [string, string][] = [
    ['Reportado por', reporta],
    ['Local', local],
    ['Tema', tema],
    ['Consulta', caso.consulta ?? '—'],
  ]
  if (numAdjuntos > 0) {
    filas.push(['Adjuntos', `Incluye ${numAdjuntos} archivo(s) adjunto(s)`])
  }
  if (sinResponsable) {
    filas.push(['Atención', 'Esta categoría no tiene responsable asignado. Revisar configuración.'])
  }

  const intro = sinResponsable
    ? 'Entró una solicitud nueva pero su categoría no tiene responsable asignado. Requiere revisión.'
    : 'Entró una solicitud nueva desde el portal.'

  const lineasTexto = [
    intro,
    '',
    `Reportado por: ${reporta}`,
    `Local: ${local}`,
    `Tema: ${tema}`,
    `Consulta: ${caso.consulta ?? '—'}`,
  ]
  if (numAdjuntos > 0) {
    lineasTexto.push(`Incluye ${numAdjuntos} archivo(s) adjunto(s)`)
  }
  lineasTexto.push('', `Ver el caso: ${link}`)
  const texto = lineasTexto.join('\n')

  const html = construirHtmlCaso({
    titulo: sinResponsable ? 'Solicitud nueva sin responsable' : 'Solicitud nueva',
    headerColor: sinResponsable ? '#D99033' : '#2563EB',
    intro,
    filas,
    link,
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Solicitud nueva: ${tema}`,
    texto,
    html,
    contexto: 'nuevo caso',
  })
}

/**
 * Notifica por correo a la contraparte cuando se agrega un comentario libre
 * en un caso (bitácora). Nunca lanza: cualquier error se loguea y se
 * descarta para no bloquear al usuario.
 */
export async function notificarComentarioCaso(
  caso: CasoCorreo,
  comentario: string,
  autorEmail: string,
  destinatarios: string[]
): Promise<void> {
  const destinatariosFinal = Array.from(
    new Set([...COPIA_PERMANENTE, ...destinatarios])
  )

  const tema = temaDe(caso)
  const colaborador = caso.colaborador_nombre ?? '—'
  const local = caso.local ?? '—'
  const escritoPor = nombreYEmail(autorEmail)
  const link = linkCaso(caso.id)

  const filas: [string, string][] = [
    ['Colaborador', colaborador],
    ['Local', local],
    ['Tema', tema],
    ['Comentario', comentario],
    ['Escrito por', escritoPor],
  ]

  const texto = [
    'Se agregó un nuevo comentario en un caso.',
    '',
    `Colaborador: ${colaborador}`,
    `Local: ${local}`,
    `Tema: ${tema}`,
    `Comentario: ${comentario}`,
    `Escrito por: ${escritoPor}`,
    '',
    `Ver el caso: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Nuevo comentario en caso',
    headerColor: '#2563EB',
    intro: 'Se agregó un nuevo comentario en un caso.',
    filas,
    link,
  })

  await enviarCorreoCaso({
    destinatarios: destinatariosFinal,
    subject: `Nuevo comentario en caso — ${tema}`,
    texto,
    html,
    contexto: 'comentario de caso',
  })
}

/**
 * Notifica por correo al nuevo responsable cuando un caso se recategoriza
 * (cambia de área). Nunca lanza: cualquier error se loguea y se descarta
 * para no bloquear al usuario.
 */
export async function notificarRecategorizacion(
  caso: CasoCorreo,
  categoriaAnterior: string,
  categoriaNueva: string,
  actorEmail: string,
  destinatario: string
): Promise<void> {
  const destinatarios = Array.from(new Set([...COPIA_PERMANENTE, destinatario]))

  const tema = temaDe(caso)
  const colaborador = caso.colaborador_nombre ?? '—'
  const local = caso.local ?? '—'
  const cambiadoPor = nombreYEmail(actorEmail)
  const link = linkCaso(caso.id)

  const filas: [string, string][] = [
    ['Colaborador', colaborador],
    ['Local', local],
    ['Categoría anterior', categoriaAnterior],
    ['Categoría nueva', categoriaNueva],
    ['Cambiado por', cambiadoPor],
  ]

  const texto = [
    'Un caso fue recategorizado y asignado a tu área.',
    '',
    `Colaborador: ${colaborador}`,
    `Local: ${local}`,
    `Categoría anterior: ${categoriaAnterior}`,
    `Categoría nueva: ${categoriaNueva}`,
    `Cambiado por: ${cambiadoPor}`,
    '',
    `Ver el caso: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Caso recategorizado',
    headerColor: '#2563EB',
    intro: 'Un caso fue recategorizado y asignado a tu área.',
    filas,
    link,
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Caso recategorizado y asignado a tu área — ${tema}`,
    texto,
    html,
    contexto: 'recategorizacion de caso',
  })
}

// --- Correos de ajustes de inventario ---

interface AjusteCorreo {
  id: string
  local: string
  tipoNombre: string
  direccion: string
  cantidadSku: number
  monto: number | null
  folioOrigen?: string | null
  folioReferencia?: string | null
  observacion?: string | null
  reportadoPor?: string | null
  folioAjuste?: string | null
  localCorreo?: string | null
}

function linkAjuste(id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${baseUrl}/ajustes/${id}`
}

/**
 * Notifica por correo cuando se registra un nuevo ajuste de inventario.
 * Destinatarios: responsable del área ajustes_inventario + contacto del grupo.
 * Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarNuevoAjuste(
  ajuste: AjusteCorreo,
  responsableCorreo: string | null,
  numAdjuntos = 0
): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [responsableCorreo, ...COPIA_PERMANENTE].filter(
        (e): e is string => typeof e === 'string' && e.includes('@')
      )
    )
  )

  const link = linkAjuste(ajuste.id)
  const direccionLabel = ajuste.direccion === 'alta' ? 'Alta' : 'Baja'

  const filas: [string, string][] = [
    ['Local', ajuste.local],
    ['Tipo', ajuste.tipoNombre],
    ['Dirección', direccionLabel],
    ['Cantidad SKU', String(ajuste.cantidadSku)],
    ['Monto', formatCLP(ajuste.monto)],
  ]
  if (ajuste.folioOrigen) filas.push(['Folio origen', ajuste.folioOrigen])
  if (ajuste.folioReferencia)
    filas.push(['Folio referencia', ajuste.folioReferencia])
  if (ajuste.observacion) filas.push(['Observación', ajuste.observacion])
  if (ajuste.reportadoPor) filas.push(['Reportado por', ajuste.reportadoPor])
  if (numAdjuntos > 0)
    filas.push(['Adjuntos', `Incluye ${numAdjuntos} archivo(s) adjunto(s)`])

  const intro =
    'Se registró un nuevo ajuste de inventario pendiente de realizar.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver el ajuste: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Nuevo ajuste de inventario',
    headerColor: '#2563EB',
    intro,
    filas,
    link,
    linkTexto: 'Ver el ajuste',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Nuevo ajuste de inventario — ${ajuste.local} — ${ajuste.tipoNombre} (${direccionLabel})`,
    texto,
    html,
    contexto: 'nuevo ajuste',
  })
}

/**
 * Notifica al ejecutor cuando un ajuste queda validado y listo para
 * ejecutarse en el sistema. Destinatarios: responsable del área
 * ajustes_ejecucion + copia permanente. Si el área no tiene responsable,
 * el correo sale igual a la copia permanente con una fila de atención.
 * Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarAjusteValidado(
  ajuste: AjusteCorreo,
  validadoPor: string,
  ejecutorCorreo: string | null
): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [ejecutorCorreo, ...COPIA_PERMANENTE].filter(
        (e): e is string => typeof e === 'string' && e.includes('@')
      )
    )
  )

  const link = linkAjuste(ajuste.id)
  const direccionLabel = ajuste.direccion === 'alta' ? 'Alta' : 'Baja'
  const sinEjecutor = !ejecutorCorreo

  const filas: [string, string][] = [
    ['Local', ajuste.local],
    ['Tipo', ajuste.tipoNombre],
    ['Dirección', direccionLabel],
    ['Cantidad SKU', String(ajuste.cantidadSku)],
    ['Monto', formatCLP(ajuste.monto)],
  ]
  if (ajuste.folioOrigen) filas.push(['Folio origen', ajuste.folioOrigen])
  if (ajuste.folioReferencia)
    filas.push(['Folio referencia', ajuste.folioReferencia])
  if (ajuste.observacion) filas.push(['Observación', ajuste.observacion])
  filas.push(['Validado por', nombreYEmail(validadoPor)])
  if (sinEjecutor) {
    filas.push([
      'Atención',
      'El área ajustes_ejecucion no tiene responsable asignado. Revisar Configuración → Derivaciones.',
    ])
  }

  const intro = 'El ajuste fue validado y está listo para realizarse en el sistema.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver el ajuste: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Ajuste de inventario validado',
    headerColor: '#7C3AED',
    intro,
    filas,
    link,
    linkTexto: 'Ver el ajuste',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Ajuste validado — ${ajuste.local} — ${ajuste.tipoNombre} (${direccionLabel})`,
    texto,
    html,
    contexto: 'ajuste validado',
  })
}

/**
 * Notifica cuando un ajuste se marca realizado, informando folio y monto
 * final. Destinatarios: la casilla del local que originó el ajuste, el
 * responsable del área y la copia permanente (mismo patrón que el cierre de casos).
 * Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarAjusteRealizado(
  ajuste: AjusteCorreo,
  cerradoPor: string,
  observacionCierre: string | null,
  responsableCorreo: string | null,
  numAdjuntos = 0
): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [
        ajuste.localCorreo,
        responsableCorreo,
        ...COPIA_PERMANENTE,
      ].filter((e): e is string => typeof e === 'string' && e.includes('@'))
    )
  )

  const link = linkAjuste(ajuste.id)
  const direccionLabel = ajuste.direccion === 'alta' ? 'Alta' : 'Baja'

  const filas: [string, string][] = [
    ['Local', ajuste.local],
    ['Tipo', ajuste.tipoNombre],
    ['Dirección', direccionLabel],
    ['Cantidad SKU', String(ajuste.cantidadSku)],
    ['Folio ajuste', ajuste.folioAjuste ?? '—'],
    ['Monto final', formatCLP(ajuste.monto)],
    ['Realizado por', nombreYEmail(cerradoPor)],
  ]
  if (observacionCierre) filas.push(['Observación', observacionCierre])
  if (numAdjuntos > 0)
    filas.push(['Adjuntos', `Incluye ${numAdjuntos} archivo(s) adjunto(s)`])

  const intro = 'El ajuste de inventario de tu local fue realizado.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver el ajuste: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Ajuste de inventario realizado',
    headerColor: '#16a34a',
    intro,
    filas,
    link,
    linkTexto: 'Ver el ajuste',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Ajuste realizado — ${ajuste.local} — folio ${ajuste.folioAjuste ?? '—'}`,
    texto,
    html,
    contexto: 'ajuste realizado',
  })
}

// --- Correos de caja chica ---

interface RendicionCorreo {
  id: string
  local: string
  periodo: string
  numero: number
  total: number
  montoFondoSnapshot?: number | null
  excedeFondo?: boolean
  localCorreo?: string | null
  reportadoPor?: string | null
}

function linkCajaChica(id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${baseUrl}/caja-chica/${id}`
}

/**
 * Notifica cuando una rendicion se envia a revision (abierto -> en_revision).
 * Destinatarios: responsable del area caja_chica + César. Si la rendicion
 * excede el fondo, agrega una linea de alerta. Nunca lanza.
 */
export async function notificarRendicionEnviada(
  rendicion: RendicionCorreo,
  responsableCorreo: string | null,
  numGastos = 0
): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [responsableCorreo, ...COPIA_PERMANENTE].filter(
        (e): e is string => typeof e === 'string' && e.includes('@')
      )
    )
  )

  const link = linkCajaChica(rendicion.id)

  const filas: [string, string][] = [
    ['Local', rendicion.local],
    ['Periodo', rendicion.periodo],
    ['N° rendición', String(rendicion.numero)],
    ['Total', formatCLP(rendicion.total)],
    [
      'Fondo asignado',
      rendicion.montoFondoSnapshot != null
        ? formatCLP(rendicion.montoFondoSnapshot)
        : 'Sin fondo',
    ],
  ]
  if (numGastos > 0) filas.push(['Gastos', `${numGastos} gasto(s)`])
  if (rendicion.reportadoPor) filas.push(['Reportado por', rendicion.reportadoPor])
  if (rendicion.excedeFondo)
    filas.push(['⚠ Alerta', 'La rendición excede el fondo asignado'])

  const intro = rendicion.excedeFondo
    ? 'Se envió una rendición de caja chica para revisión. Atención: excede el fondo asignado.'
    : 'Se envió una rendición de caja chica para revisión.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver la rendición: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Rendición de caja chica enviada',
    headerColor: rendicion.excedeFondo ? '#d97706' : '#2563EB',
    intro,
    filas,
    link,
    linkTexto: 'Ver la rendición',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Rendición de caja chica enviada — ${rendicion.local} — ${rendicion.periodo}${
      rendicion.excedeFondo ? ' (excede fondo)' : ''
    }`,
    texto,
    html,
    contexto: 'rendición enviada',
  })
}

/**
 * Notifica el resultado de la revision (aprobada / aprobada_parcial / rechazada).
 * Destinatarios: casilla del local + responsable del area + César. Incluye el
 * motivo cuando hubo rechazo. Nunca lanza.
 */
export async function notificarRendicionResuelta(
  rendicion: RendicionCorreo,
  estadoFinal: EstadoRendicion,
  resueltoPor: string,
  observacionCierre: string | null,
  responsableCorreo: string | null,
  aprobados = 0,
  rechazados = 0
): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [
        rendicion.localCorreo,
        responsableCorreo,
        ...COPIA_PERMANENTE,
      ].filter((e): e is string => typeof e === 'string' && e.includes('@'))
    )
  )

  const link = linkCajaChica(rendicion.id)
  const estadoLabel = ESTADO_RENDICION_LABEL[estadoFinal] ?? estadoFinal

  const filas: [string, string][] = [
    ['Local', rendicion.local],
    ['Periodo', rendicion.periodo],
    ['N° rendición', String(rendicion.numero)],
    ['Resultado', estadoLabel],
    ['Total aprobado', formatCLP(rendicion.total)],
    ['Gastos aprobados', String(aprobados)],
    ['Gastos rechazados', String(rechazados)],
    ['Revisado por', nombreYEmail(resueltoPor)],
  ]
  if (observacionCierre) filas.push(['Motivo / observación', observacionCierre])

  const intro =
    estadoFinal === 'aprobada'
      ? 'Tu rendición de caja chica fue aprobada.'
      : estadoFinal === 'aprobada_parcial'
        ? 'Tu rendición fue aprobada parcialmente; los gastos rechazados se arrastran a la siguiente rendición.'
        : 'Tu rendición de caja chica fue rechazada.'

  const headerColor =
    estadoFinal === 'aprobada'
      ? '#16a34a'
      : estadoFinal === 'aprobada_parcial'
        ? '#d97706'
        : '#dc2626'

  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver la rendición: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: `Rendición ${estadoLabel.toLowerCase()}`,
    headerColor,
    intro,
    filas,
    link,
    linkTexto: 'Ver la rendición',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Rendición ${estadoLabel} — ${rendicion.local} — ${rendicion.periodo}`,
    texto,
    html,
    contexto: 'rendición resuelta',
  })
}

/**
 * Recordatorio de fin de mes: "rinde tu caja chica". Se envia a la unidad
 * (correo ya resuelto por el cron). Si el correo cayo al fallback de César
 * (unidad sin correo configurado), lo indica en el cuerpo. Nunca lanza.
 */
export async function notificarRecordatorioCajaChica(
  destinatario: string,
  local: string,
  opts?: { sinCorreoConfigurado?: boolean }
): Promise<void> {
  const destinatarios = [destinatario].filter(
    (e): e is string => typeof e === 'string' && e.includes('@')
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const link = `${baseUrl}/caja-chica`

  const filas: [string, string][] = [['Local', local]]
  if (opts?.sinCorreoConfigurado) {
    filas.push([
      '⚠ Aviso',
      `La unidad ${local} no tiene correo configurado; este recordatorio llega a César.`,
    ])
  }

  const intro =
    'Recordatorio de fin de mes: rinde la caja chica del periodo para esta unidad.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ir a caja chica: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Recordatorio de caja chica',
    headerColor: '#2563EB',
    intro,
    filas,
    link,
    linkTexto: 'Ir a caja chica',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Recordatorio: rinde tu caja chica — ${local}`,
    texto,
    html,
    contexto: 'recordatorio caja chica',
  })
}

// --- Correos de Gestion ---

function linkGestion(id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${baseUrl}/gestion/${id}`
}

function asuntoGestionCreada(fila: Gestion): string {
  if (fila.tipo === 'solicitud') return `Nueva solicitud — ${fila.titulo}`
  if (fila.tipo === 'memo') return `Nuevo memo — ${fila.titulo}`
  return `Nuevo comunicado — ${fila.titulo}`
}

/**
 * Notifica al local (correo del local + copia permanente) cuando se crea una
 * gestion nueva (solicitud/memo/comunicado). Nunca lanza: cualquier error se
 * loguea y se descarta para no bloquear la creacion.
 *
 * En envios masivos, incluirCopiaPermanente debe ir en false: la copia
 * permanente recibe un unico correo resumen (ver notificarGestionMasivaCreada)
 * en vez de uno por cada local.
 */
export async function notificarGestionCreada(
  fila: Gestion,
  incluirCopiaPermanente: boolean = true
): Promise<void> {
  const base = incluirCopiaPermanente ? [...COPIA_PERMANENTE] : []
  const destinatarios = Array.from(
    new Set(
      [...base, fila.local_correo].filter(
        (e): e is string => typeof e === 'string' && e.includes('@')
      )
    )
  )

  const link = linkGestion(fila.id)
  const subject = asuntoGestionCreada(fila)

  const filas: [string, string][] = [
    ['Local', fila.local],
    ['Título', fila.titulo],
  ]
  if (fila.instrucciones) filas.push(['Instrucciones', fila.instrucciones])
  if (fila.fecha_limite) filas.push(['Fecha límite', fila.fecha_limite])
  if (fila.tipo === 'comunicado' && fila.folio_externo) {
    filas.push(['Folio externo', fila.folio_externo])
  }

  const intro =
    fila.tipo === 'solicitud'
      ? 'Se te envió una solicitud que requiere respuesta con documento adjunto.'
      : fila.tipo === 'memo'
        ? 'Se te envió un memo. Marca como leído una vez revisado.'
        : 'Se te envió un comunicado. Marca como leído una vez revisado.'

  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: subject,
    headerColor: '#2563EB',
    intro,
    filas,
    link,
    linkTexto: 'Ver',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject,
    texto,
    html,
    contexto: 'gestion creada',
  })
}

/**
 * Notifica a la copia permanente con UN SOLO correo resumen cuando se crea un
 * envio masivo de gestion (a todos los locales o por empresa), en vez de un
 * correo por cada local. Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarGestionMasivaCreada(datos: {
  tipo: Gestion['tipo']
  titulo: string
  cantidadLocales: number
  destinoDescripcion: string
}): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const link = `${baseUrl}/gestion`
  const subject = `Nuevo envío masivo: ${datos.titulo}`
  const filas: [string, string][] = [
    ['Tipo', TIPO_GESTION_LABEL[datos.tipo]],
    ['Título', datos.titulo],
    ['Destino', datos.destinoDescripcion],
    ['Locales', String(datos.cantidadLocales)],
  ]
  const intro = `Se creó un envío masivo a ${datos.cantidadLocales} locales (${datos.destinoDescripcion}). Este correo resume el envío completo — no llegará uno por cada local.`
  const texto = [intro, '', ...filas.map(([k, v]) => `${k}: ${v}`), '', `Ver: ${link}`].join('\n')

  const html = construirHtmlCaso({
    titulo: subject,
    headerColor: '#2563EB',
    intro,
    filas,
    link,
    linkTexto: 'Ver en el panel',
  })

  await enviarCorreoCaso({
    destinatarios: COPIA_PERMANENTE,
    subject,
    texto,
    html,
    contexto: 'gestion masiva creada',
  })
}

/**
 * Notifica a quien creó la gestion cuando el local responde una solicitud.
 * Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarGestionRespondida(fila: Gestion): Promise<void> {
  const destinatarios = Array.from(
    new Set(
      [...COPIA_PERMANENTE, fila.creado_por].filter(
        (e): e is string => typeof e === 'string' && e.includes('@')
      )
    )
  )

  const link = linkGestion(fila.id)
  const respondidoPor = fila.respondido_por ? nombreYEmail(fila.respondido_por) : '—'

  const filas: [string, string][] = [
    ['Local', fila.local],
    ['Título', fila.titulo],
    ['Respondido por', respondidoPor],
    ['Fecha respuesta', formatFecha(fila.fecha_respuesta)],
  ]

  const intro = 'Tu solicitud fue respondida.'
  const texto = [
    intro,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Solicitud respondida',
    headerColor: '#16a34a',
    intro,
    filas,
    link,
    linkTexto: 'Ver',
  })

  await enviarCorreoCaso({
    destinatarios,
    subject: `Solicitud respondida — ${fila.titulo}`,
    texto,
    html,
    contexto: 'gestion respondida',
  })
}

/**
 * Notifica por correo a la contraparte cuando se agrega un comentario libre
 * en una gestion (bitácora). Destinatarios: quien no escribió, entre local y
 * quien creó. Nunca lanza: cualquier error se loguea y se descarta.
 */
export async function notificarComentarioGestion(
  fila: Gestion,
  comentario: string,
  autorEmail: string,
  destinatarios: string[]
): Promise<void> {
  const destinatariosFinal = Array.from(
    new Set([...COPIA_PERMANENTE, ...destinatarios])
  )

  const link = linkGestion(fila.id)
  const escritoPor = nombreYEmail(autorEmail)

  const filas: [string, string][] = [
    ['Local', fila.local],
    ['Título', fila.titulo],
    ['Comentario', comentario],
    ['Escrito por', escritoPor],
  ]

  const texto = [
    'Se agregó un nuevo comentario en una gestión.',
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver: ${link}`,
  ].join('\n')

  const html = construirHtmlCaso({
    titulo: 'Nuevo comentario en gestión',
    headerColor: '#2563EB',
    intro: 'Se agregó un nuevo comentario en una gestión.',
    filas,
    link,
    linkTexto: 'Ver',
  })

  await enviarCorreoCaso({
    destinatarios: destinatariosFinal,
    subject: `Nuevo comentario en gestión — ${fila.titulo}`,
    texto,
    html,
    contexto: 'comentario de gestion',
  })
}
