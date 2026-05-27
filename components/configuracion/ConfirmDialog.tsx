'use client'

interface Props {
  mensaje: string
  confirmando?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  mensaje,
  confirmando,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-gray-200 shadow-lg max-w-md w-full p-6">
        <p className="text-sm text-gray-800">{mensaje}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={confirmando}
            className="border border-gray-300 text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-50 transition-colors"
          >
            {confirmando ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
