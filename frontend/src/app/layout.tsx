import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const description = `Eventos, espaços, agentes, projetos e oportunidades culturais de ${city} e do Ceará.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: "Mapa Cultural", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title: SITE_NAME, description, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0b3a5c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
