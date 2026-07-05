interface Props {
  texto: string | null
}

/** Panel de ayuda (solo lectura) con las instrucciones que edita el admin. */
export default function InstruccionesPanel({ texto }: Props) {
  if (!texto || !texto.trim()) return null
  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 p-4">
      <h3 className="text-sm font-semibold text-blue-900 mb-1">
        Instrucciones de caja chica
      </h3>
      <p className="text-sm text-blue-900/80 whitespace-pre-wrap">{texto}</p>
    </div>
  )
}
