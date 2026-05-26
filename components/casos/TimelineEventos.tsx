import type { Evento } from '@/types/caso'
import { formatFecha } from '@/lib/utils'

interface Props {
  eventos: Evento[]
}

export default function TimelineEventos({ eventos }: Props) {
  if (eventos.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Sin eventos registrados todavía.
      </div>
    )
  }

  return (
    <ol className="space-y-4">
      {eventos.map((ev) => (
        <li key={ev.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-accent mt-1.5" />
            <div className="flex-1 w-px bg-gray-200 mt-1" />
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium text-gray-900">{ev.tipo}</div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {formatFecha(ev.created_at)}
              </div>
            </div>
            {ev.detalle && (
              <div className="text-sm text-gray-700 mt-0.5">{ev.detalle}</div>
            )}
            {ev.actor && (
              <div className="text-xs text-gray-500 mt-1">por {ev.actor}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
