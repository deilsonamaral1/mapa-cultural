import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: `Mapa Cultural de ${city}`,
  description: `Eventos, espaços, agentes, projetos e oportunidades culturais de ${city} e do Ceará.`,
};

export const viewport: Viewport = { themeColor: "#0b3a5c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
