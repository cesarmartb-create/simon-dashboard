interface Props {
  titulo: string
  valor: string | number
  subtitulo?: string
  acento?: boolean
}

export default function KPICard({ titulo, valor, subtitulo, acento }: Props) {
  return (
    <div className="bg-white border border-gray-200 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">{titulo}</div>
      <div
        className={`mt-2 text-3xl font-semibold ${
          acento ? 'text-accent' : 'text-gray-900'
        }`}
      >
        {valor}
      </div>
      {subtitulo && (
        <div className="mt-1 text-xs text-gray-500">{subtitulo}</div>
      )}
    </div>
  )
}
