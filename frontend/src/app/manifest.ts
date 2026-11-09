import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mapa Cultural de Aquiraz",
    short_name: "Mapa Cultural",
    description: "Eventos, espaços, agentes, projetos e oportunidades culturais de Aquiraz e do Ceará.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b3a5c",
    theme_color: "#0b3a5c",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
