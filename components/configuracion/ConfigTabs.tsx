'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@/types/usuario'
import { cn } from '@/lib/utils'

interface Props {
  rol: Rol
}

const TABS: { href: string; label: string; roles: Rol[] }[] = [
  {
    href: '/configuracion/colaboradores',
    label: 'Colaboradores',
    roles: ['admin', 'operador'],
  },
  {
    href: '/configuracion/derivaciones',
    label: 'Derivaciones',
    roles: ['admin'],
  },
  { href: '/configuracion/locales', label: 'Locales', roles: ['admin'] },
  { href: '/configuracion/cargos', label: 'Cargos', roles: ['admin'] },
  { href: '/configuracion/agente', label: 'Agente', roles: ['admin'] },
]

export default function ConfigTabs({ rol }: Props) {
  const pathname = usePathname()
  const visibles = TABS.filter((t) => t.roles.includes(rol))

  return (
    <nav className="flex gap-1 border-b border-gray-200">
      {visibles.map((tab) => {
        const activo = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activo
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
