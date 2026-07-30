import Link from 'next/link'
import { cn } from '@/lib/utils'

type BadgeTono = 'danger' | 'warning'

const BADGE_ESTILO: Record<BadgeTono, string> = {
  danger: 'bg-red-50 text-red-700 border-red-300',
  warning: 'bg-amber-50 text-amber-700 border-amber-300',
}

interface Props {
  href: string
  titulo: string
  numero: number
  etiqueta: string
  badge?: string
  badgeTono?: BadgeTono
}

export default function TarjetaModulo({
  href,
  titulo,
  numero,
  etiqueta,
  badge,
  badgeTono = 'warning',
}: Props) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 p-5 hover:border-accent transition-colors"
    >
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
        {titulo}
      </div>
      <div className="text-3xl font-semibold text-gray-900 mt-2">{numero}</div>
      <div className="text-sm text-gray-500 mt-1">{etiqueta}</div>
      {badge && (
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 text-xs font-medium border mt-3',
            BADGE_ESTILO[badgeTono]
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
