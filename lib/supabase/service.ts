import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con SERVICE ROLE: bypassa RLS. Uso EXCLUSIVO en rutas sin
 * sesion de usuario (p. ej. el cron de recordatorio), y solo tras validar el
 * secreto de la ruta.
 *
 * El import 'server-only' de la primera linea hace FALLAR EL BUILD si este
 * modulo se importa desde un componente cliente: la llave nunca puede llegar
 * al navegador.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
    )
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
