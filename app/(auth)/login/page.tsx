import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold text-gray-900">Panel Simón</div>
          <div className="mt-1 text-sm text-gray-500">
            Acceso para el equipo interno
          </div>
        </div>

        <Suspense
          fallback={
            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-500">
              Cargando…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <img
          src="/logo-grupo-baco.png"
          alt="Grupo Baco"
          className="h-16 mx-auto mt-10"
        />

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <img src="/budo-symbol.svg" alt="" className="h-3.5 w-3.5" />
          <span>por Budo AI</span>
        </div>
      </div>
    </div>
  )
}
