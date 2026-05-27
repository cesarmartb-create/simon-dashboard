import Header from '@/components/layout/Header'
import ConfigTabs from '@/components/configuracion/ConfigTabs'
import { requireConfiguracion } from '@/lib/sesion'

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await requireConfiguracion()

  return (
    <>
      <Header usuario={usuario} titulo="Configuración" />
      <main className="flex-1 p-8 overflow-y-auto">
        <ConfigTabs rol={usuario.rol} />
        <div className="mt-6">{children}</div>
      </main>
    </>
  )
}
