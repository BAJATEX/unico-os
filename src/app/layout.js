import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ÚNICO OS | Panel de Control',
  description: 'Sistema de Gestión Empresarial',
  manifest: '/manifest.json', // Conexión Vital PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Único OS',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Sensación de App nativa
  }
}

export const viewport = {
  themeColor: '#E10600',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{__html: `
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  unico: {
                    50: '#fff1f1',
                    100: '#ffdfdf',
                    600: '#E10600', // Rojo Oficial
                    800: '#990400',
                    900: '#1a1a1a',
                  },
                  score: {
                    blue: '#003366'
                  }
                }
              }
            }
          }
        `}} />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased overflow-hidden`}>
        {children}
      </body>
    </html>
  )
}