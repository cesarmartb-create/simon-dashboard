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
              href="/casos?estado=abierto&estado=en_gestion&estado=esperando_empleado&estado=escalado"
              titulo="Casos"
              numero={resumenCasos.total}
              etiqueta="activos"
              desglose={[
                { etiqueta: 'abiertos', cantidad: resumenCasos.abierto, color: 'gray' },
                { etiqueta: 'en gestión', cantidad: resumenCasos.enGestion, color: 'blue' },
                { etiqueta: 'esperando', cantidad: resumenCasos.esperandoEmpleado, color: 'amber' },
                { etiqueta: 'escalados', cantidad: resumenCasos.escalado, color: 'red' },
              ]}
            />
          )}

          {resumenAjustes && (
            <TarjetaModulo
              href="/ajustes?estado=pendiente&estado=validado"
              titulo="Ajustes"
              numero={resumenAjustes.total}
              etiqueta="activos"
              desglose={[
                { etiqueta: 'pendientes', cantidad: resumenAjustes.pendiente, color: 'amber' },
                { etiqueta: 'validados', cantidad: resumenAjustes.validado, color: 'blue' },
              ]}
            />
          )}

          {resumenCajaChica && (
            <TarjetaModulo
              href="/caja-chica?estado=en_revision&estado=aprobada&estado=aprobada_parcial"
              titulo="Caja chica"
              numero={resumenCajaChica.total}
              etiqueta="activas"
              desglose={[
                { etiqueta: 'en revisión', cantidad: resumenCajaChica.enRevision, color: 'amber' },
                {
                  etiqueta: 'aprobadas',
                  cantidad: resumenCajaChica.aprobada + resumenCajaChica.aprobadaParcial,
                  color: 'blue',
                },
              ]}
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
            desglose={[
              { etiqueta: 'Documental', cantidad: resumenGestion.documental, color: 'gray' },
              { etiqueta: 'Solicitudes', cantidad: resumenGestion.solicitudes, color: 'gray' },
              { etiqueta: 'Comunicado Interno', cantidad: resumenGestion.comunicadoInterno, color: 'gray' },
              { etiqueta: 'Comunicado Simi', cantidad: resumenGestion.comunicadoSimi, color: 'gray' },
            ]}
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
