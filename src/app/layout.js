import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://unicos-admin.vercel.app");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "UnicOs Admin",
  description:
    "Centro de control de UnicOs para administrar operaciones, contenido y tiendas conectadas.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UnicOs",
  },
  openGraph: {
    title: "UnicOs Admin",
    description:
      "Centro de control de UnicOs para administrar operaciones, contenido y tiendas conectadas.",
    url: siteUrl,
    siteName: "UnicOs Admin",
    locale: "es_MX",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}