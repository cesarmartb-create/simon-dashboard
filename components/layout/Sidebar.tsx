'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Usuario } from '@/types/usuario'
import { cn } from '@/lib/utils'
import { puedeVerAjustes, AREA_AJUSTES } from '@/lib/ajustes'
import { puedeVerCajaChica, AREA_CAJA_CHICA } from '@/lib/cajachica'

interface Props {
  usuario: Usuario
}

// Areas que "gobiernan" un modulo propio. El resto de las areas son de
// categorias de casos.
const AREAS_MODULO = [AREA_AJUSTES, AREA_CAJA_CHICA]

/**
 * Casos: admin y qf siempre; gestor si tiene alguna area (en areas ∪
 * areas_supervisa) que NO sea de modulo (Ajustes/Caja chica).
 * Ej: Maria Andrea (operaciones + supervisa ajustes) conserva Casos.
 */
function puedeVerCasos(usuario: Usuario): boolean {
  if (usuario.rol === 'admin' || usuario.rol === 'qf') return true
  const areas = [...(usuario.areas ?? []), ...(usuario.areas_supervisa ?? [])]
  return usuario.rol === 'gestor' && areas.some((a) => !AREAS_MODULO.includes(a))
}

const ITEMS: {
  href: string
  label: string
  visible: (u: Usuario) => boolean
}[] = [
  { href: '/casos', label: 'Casos', visible: puedeVerCasos },
  { href: '/ajustes', label: 'Ajustes', visible: puedeVerAjustes },
  { href: '/caja-chica', label: 'Caja chica', visible: puedeVerCajaChica },
  { href: '/metricas', label: 'Métricas', visible: (u) => u.rol === 'admin' },
  { href: '/equipo', label: 'Equipo', visible: (u) => u.rol === 'admin' },
  {
    href: '/configuracion',
    label: 'Configuración',
    visible: (u) => u.rol === 'admin',
  },
]

export default function Sidebar({ usuario }: Props) {
  const pathname = usePathname()

  const visibles = ITEMS.filter((i) => i.visible(usuario))

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
        <img
          src="/logo-grupo-baco-blanco.png"
          alt="Grupo Baco"
          className="h-12 w-auto mb-2 opacity-90"
        />
        <div className="flex items-center gap-1.5 mb-1 text-white/40">
          <img src="/budo-symbol-cream.svg" alt="" className="h-3.5 w-3.5 opacity-70" />
          <span>por Budo AI</span>
        </div>
        <div>v0.1 - {process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ?? 'dev'}</div>
      </div>
    </aside>
  )
}
