import "./globals.css";
import SwRegister from "./sw-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const viewport = {
  themeColor: "#0f0f10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  // Migrado a Vercel dinámica o fallback
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://unicos-admin.vercel.app"),
  title: "UnicOs Admin",
  description: "Centro de control de UnicOs para administrar operaciones, contenido y tiendas conectadas.",
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
