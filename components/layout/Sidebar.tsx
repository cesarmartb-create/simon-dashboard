'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Usuario, Rol } from '@/types/usuario'
import { cn } from '@/lib/utils'

interface Props {
  usuario: Usuario
}

const ITEMS: { href: string; label: string; roles: Rol[] }[] = [
  {
    href: '/casos',
    label: 'Casos',
    roles: ['admin', 'gestor', 'qf'],
  },
  { href: '/metricas', label: 'Métricas', roles: ['admin'] },
  { href: '/equipo', label: 'Equipo', roles: ['admin'] },
  {
    href: '/configuracion',
    label: 'Configuración',
    roles: ['admin'],
  },
]

export default function Sidebar({ usuario }: Props) {
  const pathname = usePathname()

  const visibles = ITEMS.filter((i) => i.roles.includes(usuario.rol))

  return (
    <aside className="w-60 bg-sidebar text-white flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="text-lg font-semibold tracking-tight">Panel Simón</div>
        <div className="text-xs text-white/50 mt-1">Gestión de casos</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibles.map((item) => {
          const activo = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 text-sm transition-colors',
                activo
                  ? 'bg-accent text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-xs text-white/50">
        <div className="flex items-center gap-2 mb-1">
          <img
            src="/isotipo-grupo-baco.png"
            alt="Grupo Baco"
            className="h-5 w-auto"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.7 }}
          />
          <span className="text-white/70 font-medium">Grupo Baco</span>
        </div>
        <div>v0.1 - {process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ?? 'dev'}</div>
      </div>
    </aside>
  )
}
