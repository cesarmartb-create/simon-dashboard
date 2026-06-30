'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [sesionValida, setSesionValida] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const code = new URLSearchParams(window.location.search).get('code')

    async function prepararSesion() {
      if (code) {
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)
        setSesionValida(!exchangeError && !!data.session)
        return
      }
      const { data } = await supabase.auth.getSession()
      setSesionValida(!!data.session)
    }

    prepararSesion()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
      return
    }

    setListo(true)
    setTimeout(() => {
      router.push('/login')
    }, 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold text-gray-900">Panel Simón</div>
          <div className="mt-1 text-sm text-gray-500">
            Define tu nueva contraseña
          </div>
        </div>

        {sesionValida === false ? (
          <div className="bg-white border border-gray-200 p-6 text-sm text-gray-700">
            Este enlace no es válido o expiró. Vuelve al{' '}
            <a href="/login" className="text-accent hover:underline">
              inicio de sesión
            </a>{' '}
            y solicita uno nuevo.
          </div>
        ) : listo ? (
          <div className="bg-white border border-gray-200 p-6 text-sm text-green-700">
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
