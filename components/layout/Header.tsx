'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/types/usuario'

interface Props {
  usuario: Usuario
  titulo: string
}

export default function Header({ usuario, titulo }: Props) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{titulo}</h1>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{usuario.nombre}</div>
          <div className="text-xs text-gray-500 capitalize">{usuario.rol}</div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-accent transition-colors border border-gray-300 px-3 py-1.5"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
