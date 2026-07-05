'use client'

export interface ExportRow {
  periodo: string
  numero_rendicion: number | string
  local: string
  fecha_gasto: string
  tipo_gasto: string
  proveedor: string
  descripcion: string
  tipo_documento: string
  n_documento: string
  forma_pago: string
  monto: number
  estado_gasto: string
  estado_rendicion: string
  centro_costo: string
}

const COLUMNAS: (keyof ExportRow)[] = [
  'periodo',
  'numero_rendicion',
  'local',
  'fecha_gasto',
  'tipo_gasto',
  'proveedor',
  'descripcion',
  'tipo_documento',
  'n_documento',
  'forma_pago',
  'monto',
  'estado_gasto',
  'estado_rendicion',
  'centro_costo',
]

// BOM UTF-8 (U+FEFF): hace que Excel abra el CSV con la codificacion correcta.
const BOM = String.fromCharCode(0xfeff)

/** Escapa un campo CSV (comillas, comas, saltos de linea). */
function escapeCsv(valor: unknown): string {
  const s = valor == null ? '' : String(valor)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

interface Props {
  filas: ExportRow[]
}

/**
 * Descarga los gastos visibles como CSV (una fila por gasto). Generacion
 * 100% en el cliente, separador coma, UTF-8 con BOM. Recibe solo lo que el
 * usuario ya puede ver (RLS + filtros activos).
 */
export default function ExportarCsvBoton({ filas }: Props) {
  function descargar() {
    const encabezado = COLUMNAS.join(',')
    const cuerpo = filas
      .map((f) => COLUMNAS.map((c) => escapeCsv(f[c])).join(','))
      .join('\r\n')
    const csv = `${BOM}${encabezado}\r\n${cuerpo}`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'caja-chica-gastos.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={descargar}
      disabled={filas.length === 0}
      className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      Exportar CSV
    </button>
  )
}
