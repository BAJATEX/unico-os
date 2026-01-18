import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ÚNICO OS | Commander',
  description: 'Sistema Operativo Enterprise',
  manifest: '/manifest.json', // VITAL PARA INSTALAR
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Único OS',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Bloquea zoom (Look nativo)
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
                  unico: { 50:'#fff1f1', 100:'#ffdfdf', 600:'#E10600', 900:'#1a1a1a' },
                  score: { blue: '#003366' }
                }
              }
            }
          }
        `}} />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased overflow-hidden select-none`}>
        {children}
      </body>
    </html>
  )
}
