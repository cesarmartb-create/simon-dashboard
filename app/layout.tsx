import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Panel Simón',
  description: 'Gestión de casos derivados por el bot Simón',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-canvas text-gray-900 font-sans">{children}</body>
    </html>
  )
}
