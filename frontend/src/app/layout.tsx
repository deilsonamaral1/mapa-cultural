import type { Metadata } from "next";
import "./globals.css";

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz";

export const metadata: Metadata = {
  title: `Mapa Cultural de ${city}`,
  description: `Agentes, espaços e eventos culturais de ${city}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
