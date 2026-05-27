import { redirect } from 'next/navigation'

export default function ConfiguracionPage() {
  // La primera pestaña (Colaboradores) es accesible para admin y operador.
  redirect('/configuracion/colaboradores')
}
