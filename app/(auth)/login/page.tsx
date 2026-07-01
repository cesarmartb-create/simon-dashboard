import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/logo-grupo-baco.png"
            alt="Grupo Baco"
            className="h-14 mx-auto mb-6"
          />
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
      </div>
    </div>
  )
}
