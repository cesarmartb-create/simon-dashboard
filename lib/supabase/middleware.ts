import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  puedeVerVistaGlobal,
  puedeAccederConfiguracion,
  esAdmin,
} from '@/lib/auth'
import type { Rol } from '@/types/usuario'

const PUBLIC_PATHS = ['/login', '/auth', '/privacidad', '/reset-password']
const ROLES_VALIDOS: Rol[] = ['admin', 'gestor', 'qf']

interface PerfilActual {
  cliente_id: string | null
  rol: string | null
  local: string | null
  areas: string[] | null
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const esPublica = PUBLIC_PATHS.some((p) => path.startsWith(p))

  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/casos'
    return NextResponse.redirect(url)
  }

  if (user && !esPublica) {
    // Gate basado en BD: el usuario debe tener fila válida en usuarios_cliente
    // (perfil_actual ya filtra por activo=true internamente).
    const { data: perfil, error: errorPerfil } = await supabase
      .rpc('perfil_actual')
      .single<PerfilActual>()

    if (
      errorPerfil ||
      !perfil ||
      !perfil.rol ||
      !ROLES_VALIDOS.includes(perfil.rol as Rol)
    ) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'sin_acceso')
      return NextResponse.redirect(url)
    }

    const rol = perfil.rol as Rol

    // Métricas y Equipo: solo vista global (admin).
    const rutasVistaGlobal = ['/metricas', '/equipo']
    if (
      rutasVistaGlobal.some((r) => path.startsWith(r)) &&
      !puedeVerVistaGlobal(rol)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/casos'
      return NextResponse.redirect(url)
    }

    // Configuración: solo admin. Sub-pestañas también solo admin.
    if (path.startsWith('/configuracion')) {
      if (!puedeAccederConfiguracion(rol)) {
        const url = request.nextUrl.clone()
        url.pathname = '/casos'
        return NextResponse.redirect(url)
      }

      const rutasSoloAdmin = [
        '/configuracion/derivaciones',
        '/configuracion/locales',
        '/configuracion/cargos',
        '/configuracion/agente',
      ]
      if (
        rutasSoloAdmin.some((r) => path.startsWith(r)) &&
        !esAdmin(rol)
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/configuracion/colaboradores'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}
