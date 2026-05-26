const SIMON_URL = 'https://simon-62wy.onrender.com/notificar-colaborador'

interface NotificarPayload {
  numero: string | null
  nombre: string | null
  estado: string
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
