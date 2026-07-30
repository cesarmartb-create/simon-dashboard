import Link from 'next/link'
import Header from '@/components/layout/Header'
import TarjetaModulo from '@/components/inicio/TarjetaModulo'
import { getUsuarioActual } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { puedeVerCasos } from '@/lib/navegacion'
import { puedeVerAjustes } from '@/lib/ajustes'
import { puedeVerCajaChica } from '@/lib/cajachica'
import {
  cargarResumenCasos,
  cargarResumenAjustes,
  cargarResumenCajaChica,
  cargarResumenGestion,
  type ResumenCasos,
  type ResumenAjustes,
  type ResumenCajaChica,
  type ResumenGestion,
} from '@/lib/inicio'

export default async function InicioPage() {
  const usuario = await getUsuarioActual()
  const supabase = createClient()

  const [resumenCasos, resumenAjustes, resumenCajaChica, resumenGestion] =
    await Promise.all([
      puedeVerCasos(usuario)
        ? cargarResumenCasos(supabase)
        : Promise.resolve(null as ResumenCasos | null),
      puedeVerAjustes(usuario)
        ? cargarResumenAjustes(supabase)
        : Promise.resolve(null as ResumenAjustes | null),
      puedeVerCajaChica(usuario)
        ? cargarResumenCajaChica(supabase)
        : Promise.resolve(null as ResumenCajaChica | null),
      cargarResumenGestion(supabase) as Promise<ResumenGestion>,
    ])

  return (
    <>
      <Header usuario={usuario} titulo="Inicio" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {resumenCasos && (
            <TarjetaModulo
              href="/casos?estado=abierto"
              titulo="Casos"
              numero={resumenCasos.abiertos}
              etiqueta="abiertos"
              badge={
                resumenCasos.escalados > 0
                  ? `${resumenCasos.escalados} escalados`
                  : undefined
              }
              badgeTono="danger"
            />
          )}

          {resumenAjustes && (
            <TarjetaModulo
              href="/ajustes?estado=pendiente"
              titulo="Ajustes"
              numero={resumenAjustes.pendientes}
              etiqueta="pendientes de validar"
            />
          )}

          {resumenCajaChica && (
            <TarjetaModulo
              href="/caja-chica?estado=en_revision"
              titulo="Caja chica"
              numero={resumenCajaChica.enRevision}
              etiqueta="en revisión"
              badge={
                resumenCajaChica.excedeFondo > 0
                  ? `${resumenCajaChica.excedeFondo} excede fondo`
                  : undefined
              }
              badgeTono="warning"
            />
          )}

          <TarjetaModulo
            href="/gestion?estado=pendiente"
            titulo="Gestión"
            numero={resumenGestion.pendientes}
            etiqueta="pendientes"
            badge={
              resumenGestion.vencidas > 0
                ? `${resumenGestion.vencidas} vencidas`
                : undefined
            }
            badgeTono="warning"
          />
        </div>

        {usuario.rol === 'admin' && (
          <div className="mt-8 flex items-center gap-6 text-sm">
            <Link href="/metricas" className="text-accent hover:underline">
              Métricas
            </Link>
            <Link href="/equipo" className="text-accent hover:underline">
              Equipo
            </Link>
            <Link href="/configuracion" className="text-accent hover:underline">
              Configuración
            </Link>
          </div>
        )}
      </main>
    </>
  )
}
