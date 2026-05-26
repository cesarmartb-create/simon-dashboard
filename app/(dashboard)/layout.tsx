import Sidebar from '@/components/layout/Sidebar'
import { getUsuarioActual } from '@/lib/sesion'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await getUsuarioActual()

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar usuario={usuario} />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  )
}
