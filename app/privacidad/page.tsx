import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad · Simón',
  description:
    'Política de privacidad del asistente conversacional Simón de Farmacéutica Salazar SpA.',
}

const ULTIMA_ACTUALIZACION = '26 de mayo de 2026'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10 border-b border-gray-200 pb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Política de Privacidad
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Asistente conversacional <strong>Simón</strong> en WhatsApp
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-700">
          <section>
            <p>
              La presente Política de Privacidad describe cómo{' '}
              <strong>Farmacéutica Salazar SpA</strong> trata los datos
              personales de las personas trabajadoras que interactúan con{' '}
              <strong>Simón</strong>, un asistente conversacional disponible a
              través de WhatsApp destinado a apoyar la gestión de consultas
              laborales internas. Al utilizar Simón, usted declara haber leído y
              comprendido los términos de esta política.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              1. Responsable del tratamiento
            </h2>
            <p>
              El responsable del tratamiento de los datos personales es{' '}
              <strong>Farmacéutica Salazar SpA</strong>, sociedad constituida en
              Chile. Para cualquier consulta relacionada con el tratamiento de
              sus datos personales o con esta política, puede comunicarse al
              correo electrónico{' '}
              <a
                href="mailto:contacto@grupobaco.cl"
                className="font-medium text-accent hover:underline"
              >
                contacto@grupobaco.cl
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              2. Datos que recolecta Simón
            </h2>
            <p className="mb-3">
              Durante el uso del servicio, Simón puede recolectar y tratar los
              siguientes datos personales:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>Nombre de la persona trabajadora.</li>
              <li>Número de teléfono asociado a su cuenta de WhatsApp.</li>
              <li>Cargo que desempeña.</li>
              <li>Local o lugar de trabajo.</li>
              <li>
                Contenido de las consultas laborales que usted envía a través
                del asistente.
              </li>
              <li>Fecha y hora de los mensajes intercambiados.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              3. Finalidad del tratamiento
            </h2>
            <p className="mb-3">
              Los datos personales recolectados son tratados con las siguientes
              finalidades:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>
                Gestión de consultas operativas, administrativas y de
                cumplimiento formuladas por las personas trabajadoras.
              </li>
              <li>
                Derivación de cada consulta a las y los responsables internos
                competentes para su atención.
              </li>
              <li>
                Registro y seguimiento del estado de las consultas hasta su
                resolución.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              4. Base legal del tratamiento
            </h2>
            <p>
              El tratamiento de sus datos personales se fundamenta en la{' '}
              <strong>relación laboral vigente</strong> entre usted y
              Farmacéutica Salazar SpA, así como en el{' '}
              <strong>consentimiento</strong> que usted otorga al utilizar
              voluntariamente el servicio Simón. Este tratamiento se realiza en
              conformidad con la Ley N° 19.628 sobre Protección de la Vida
              Privada y considerando la Ley N° 21.719, que entra en vigencia en
              diciembre de 2026.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              5. Destinatarios y comunicación de datos
            </h2>
            <p className="mb-3">
              Sus datos personales son accesibles únicamente por el personal
              autorizado de Farmacéutica Salazar SpA y de las empresas
              relacionadas del grupo, en la medida estrictamente necesaria para
              atender sus consultas.
            </p>
            <p className="mb-3">
              Adicionalmente, para la operación técnica del servicio,
              determinados datos pueden ser tratados por los siguientes
              proveedores tecnológicos, quienes actúan como encargados de
              tratamiento bajo el correspondiente contrato de tratamiento de
              datos:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>Anthropic (procesamiento del modelo conversacional).</li>
              <li>WhatsApp (canal de mensajería).</li>
              <li>Supabase (almacenamiento de datos).</li>
              <li>Render (infraestructura de alojamiento).</li>
              <li>SendGrid (envío de notificaciones por correo).</li>
              <li>Upstash (servicios de almacenamiento en memoria y colas).</li>
            </ul>
            <p className="mt-3">
              Estos proveedores tratan los datos exclusivamente conforme a las
              instrucciones de Farmacéutica Salazar SpA y para las finalidades
              aquí descritas.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              6. Plazo de conservación
            </h2>
            <p>
              Sus datos personales serán conservados mientras se mantenga
              vigente la relación laboral y, posteriormente, hasta por un plazo
              de <strong>cinco (5) años</strong>, con el objeto de dar
              cumplimiento a las obligaciones legales aplicables. Cumplido dicho
              plazo, los datos serán eliminados o anonimizados de forma segura.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              7. Derechos del titular
            </h2>
            <p className="mb-3">
              Como titular de los datos, usted puede ejercer en cualquier
              momento sus derechos de{' '}
              <strong>
                acceso, rectificación, cancelación y oposición (derechos ARCO)
              </strong>{' '}
              respecto de sus datos personales:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>
                <strong>Acceso:</strong> conocer qué datos suyos son tratados.
              </li>
              <li>
                <strong>Rectificación:</strong> solicitar la corrección de datos
                inexactos o desactualizados.
              </li>
              <li>
                <strong>Cancelación:</strong> solicitar la eliminación de sus
                datos cuando proceda.
              </li>
              <li>
                <strong>Oposición:</strong> oponerse al tratamiento de sus datos
                por motivos legítimos.
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer estos derechos, envíe su solicitud al correo{' '}
              <a
                href="mailto:contacto@grupobaco.cl"
                className="font-medium text-accent hover:underline"
              >
                contacto@grupobaco.cl
              </a>
              , indicando su nombre completo y la naturaleza de su requerimiento.
              Su solicitud será atendida dentro de los plazos establecidos por
              la legislación vigente.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              8. Medidas de seguridad
            </h2>
            <p className="mb-3">
              Farmacéutica Salazar SpA aplica medidas técnicas y organizativas
              razonables para proteger sus datos personales, entre ellas:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>Cifrado de la información en tránsito.</li>
              <li>Control de acceso basado en roles de usuario.</li>
              <li>Registro de auditoría de las acciones realizadas.</li>
            </ul>
          </section>

          <section className="border-l-4 border-amber-400 bg-amber-50 p-5">
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              9. Canales que Simón NO reemplaza
            </h2>
            <p className="mb-3">
              Simón es un asistente para consultas laborales y{' '}
              <strong>no constituye un canal formal de denuncias</strong>. En
              particular:
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>
                Simón <strong>no</strong> es el canal para denuncias en el marco
                de la <strong>Ley Karin</strong> (acoso laboral, sexual y
                violencia en el trabajo). Dichas denuncias deben realizarse a
                través del <strong>código QR disponible en cada local</strong>.
              </li>
              <li>
                Simón <strong>no</strong> es el canal para denuncias de{' '}
                <strong>compliance</strong>. Estas deben dirigirse al correo{' '}
                <a
                  href="mailto:denuncia@grupobaco.cl"
                  className="font-medium text-accent hover:underline"
                >
                  denuncia@grupobaco.cl
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              10. Modificaciones a esta política
            </h2>
            <p>
              Farmacéutica Salazar SpA podrá actualizar esta Política de
              Privacidad cuando sea necesario. La versión vigente será siempre la
              publicada en esta página, indicándose su fecha de última
              actualización al inicio del documento.
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-gray-200 pt-8">
          <Link
            href="/"
            className="text-sm font-medium text-accent hover:underline"
          >
            ← Volver al inicio
          </Link>
        </footer>
      </main>
    </div>
  )
}
