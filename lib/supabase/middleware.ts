import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getUsuario,
  puedeVerVistaGlobal,
  puedeAccederConfiguracion,
  esAdmin,
} from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/auth', '/privacidad']

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
    const usuario = getUsuario(user.email)
    if (!usuario) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'sin_acceso')
      return NextResponse.redirect(url)
    }

    // Métricas y Equipo: solo vista global (admin / supervisor).
    const rutasVistaGlobal = ['/metricas', '/equipo']
    if (
      rutasVistaGlobal.some((r) => path.startsWith(r)) &&
      !puedeVerVistaGlobal(usuario.rol)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/casos'
      return NextResponse.redirect(url)
    }

    // Configuración: admin u operador. Sub-pestañas restringidas a admin.
    if (path.startsWith('/configuracion')) {
      if (!puedeAccederConfiguracion(usuario.rol)) {
        const url = request.nextUrl.clone()
        url.pathname = '/casos'
        return NextResponse.redirect(url)
      }

      const rutasSoloAdmin = [
        '/configuracion/derivaciones',
        '/configuracion/locales',
        '/configuracion/agente',
      ]
      if (
        rutasSoloAdmin.some((r) => path.startsWith(r)) &&
        !esAdmin(usuario.rol)
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/configuracion/colaboradores'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}
