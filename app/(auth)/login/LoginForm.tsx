'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorInicial = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviandoReset, setEnviandoReset] = useState(false)
  const [error, setError] = useState<string | null>(
    errorInicial === 'sin_acceso'
      ? 'Tu cuenta no tiene acceso al panel. Contacta al supervisor.'
      : null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    })
    setLoading(false)

    if (authError) {
      setError('Credenciales inválidas.')
      return
    }

    router.push('/casos')
    router.refresh()
  }

  async function handleReset() {
    setError(null)
    setAviso(null)
    if (!email.trim()) {
      setError('Escribe tu correo para enviarte el enlace de recuperacion.')
      return
    }
    setEnviandoReset(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: 'https://simon-dashboard-ochre.vercel.app/reset-password',
    })
    setEnviandoReset(false)
    setAviso('Si el correo esta registrado, te enviamos un enlace para restablecer tu contrasena. Revisa tu bandeja de entrada.')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 p-6 space-y-4"
    >
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-accent"
          placeholder="tu.email@grupobaco.cl"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
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
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>

      {aviso && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2">
          {aviso}
        </div>
      )}

      <button
        type="button"
        onClick={handleReset}
        disabled={enviandoReset}
        className="w-full text-xs text-gray-500 hover:text-accent disabled:opacity-50 transition-colors"
      >
        {enviandoReset ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
      </button>
    </form>
  )
}
