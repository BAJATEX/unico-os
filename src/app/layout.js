import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ÚNICO OS | Panel Corporativo',
  description: 'Sistema de Gestión Centralizado',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Motor de Diseño Automático (Tailwind) */}
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Configuración de colores corporativos de Único */}
        <script dangerouslySetInnerHTML={{__html: `
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  unico: {
                    50: '#f0f4ff',
                    100: '#e0e8ff',
                    600: '#E10600', // Rojo Score/Único
                    800: '#1e3a8a', // Azul Corporativo Profundo
                    900: '#111827',
                  }
                }
              }
            }
          }
        `}} />
      </head>
      <body className={`${inter.className} bg-slate-50 text-slate-600 antialiased`}>
        {children}
      </body>
    </html>
  )
}
