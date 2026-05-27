'use client'

import { useState } from 'react'

export default function AgenteForm() {
  const [nombre, setNombre] = useState('Simón')
  const [empresa, setEmpresa] = useState('Farmacéutica Salazar SpA')
  const [horario, setHorario] = useState('Lunes a viernes, 09:00 a 18:00')
  const [guardado, setGuardado] = useState(false)

  function guardar() {
    // Sin backend por ahora; Supabase vendrá después.
    setGuardado(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Agente</h2>
        <p className="text-sm text-gray-500">
          Configuración general del asistente Simón.
        </p>
      </div>

      <div className="bg-white border border-gray-200 p-5 space-y-4 max-w-2xl">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Nombre del agente
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              setGuardado(false)
            }}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Empresa
          </label>
          <input
            type="text"
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value)
              setGuardado(false)
            }}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Horario de atención
          </label>
          <input
            type="text"
            value={horario}
            onChange={(e) => {
              setHorario(e.target.value)
              setGuardado(false)
            }}
            className="px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">
            Límite mensual de conversaciones
          </label>
          <input
            type="text"
            value="5.000"
            disabled
            readOnly
            className="px-3 py-2 border border-gray-200 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
          />
          <span className="text-xs text-gray-400 mt-1">
            Este valor solo puede ser modificado por Budo AI.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Guardar cambios
        </button>
        {guardado && (
          <span className="text-sm text-emerald-700">
            Cambios guardados (demostración, aún sin persistir).
          </span>
        )}
      </div>
    </div>
  )
}
