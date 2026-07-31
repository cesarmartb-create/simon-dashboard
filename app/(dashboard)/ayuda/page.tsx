import Header from '@/components/layout/Header'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeGestionarCajaChica } from '@/lib/cajachica'

const MANUALES_BUCKET = 'manuales'

interface Manual {
  nombre: string
  href: string
}

async function firmarManual(
  supabase: ReturnType<typeof createClient>,
  ruta: string
): Promise<string | null> {
  try {
    const { data: firma } = await supabase.storage
      .from(MANUALES_BUCKET)
      .createSignedUrl(ruta, 3600)
    return firma?.signedUrl ?? null
  } catch (error) {
    console.error('[ayuda] createSignedUrl falló:', error)
    return null
  }
}

export default async function AyudaPage() {
  const usuario = await getUsuarioActual()

  const esQF = usuario.rol === 'qf'
  const esGestor = usuario.rol === 'gestor'
  const esAdmin = usuario.rol === 'admin'
  const esTitularOC = usuario.local?.startsWith('OC-') ?? false
  const puedeRevisarCaja = puedeGestionarCajaChica(usuario)

  const manuales: Manual[] = [
    { nombre: 'Manual Panel Simón', href: '/manuales/Manual_Panel_Simon.pdf' },
  ]

  if (esQF || esAdmin) {
    manuales.push({
      nombre: 'Manual Caja Chica - Locales',
      href: '/manuales/Manual_Caja_Chica_Locales.pdf',
    })
    manuales.push({
      nombre: 'Manual Gestión - QF',
      href: '/manuales/Manual_Gestion_QF.pdf',
    })
  }

  if (esGestor || esAdmin) {
    manuales.push({
      nombre: 'Manual Gestión - Gestoras',
      href: '/manuales/Manual_Gestion_Gestoras.pdf',
    })
  }

  if (esTitularOC || esAdmin) {
    const supabase = createClient()
    const url = await firmarManual(supabase, 'Manual_Caja_Chica_Titulares.pdf')
    if (url) {
      manuales.push({ nombre: 'Manual Caja Chica - Titulares', href: url })
    }
  }

  if (puedeRevisarCaja || esAdmin) {
    const supabase = createClient()
    const url = await firmarManual(supabase, 'Manual_Caja_Chica_Revisora.pdf')
    if (url) {
      manuales.push({ nombre: 'Manual Caja Chica - Revisora', href: url })
    }
  }

  return (
    <>
      <Header usuario={usuario} titulo="Ayuda" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Manuales</h2>
          <p className="text-sm text-gray-500 mt-1">
            Documentos de referencia disponibles para tu rol.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {manuales.map((manual) => (
            <a
              key={manual.href}
              href={manual.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-gray-200 p-5 hover:border-accent transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">
                {manual.nombre}
              </div>
              <div className="text-xs text-gray-500 mt-1">Abrir PDF</div>
            </a>
          ))}
        </div>
      </main>
    </>
  )
}
