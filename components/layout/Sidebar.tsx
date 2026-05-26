'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Usuario } from '@/types/usuario'
import { cn } from '@/lib/utils'

interface Props {
  usuario: Usuario
}

const ITEMS = [
  { href: '/casos', label: 'Casos', roles: ['supervisor', 'gestor'] },
  { href: '/metricas', label: 'Métricas', roles: ['supervisor'] },
  { href: '/equipo', label: 'Equipo', roles: ['supervisor'] },
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
        v0.1.0
      </div>
    </aside>
  )
}
