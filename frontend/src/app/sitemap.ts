import type { MetadataRoute } from "next";
import { idsOficiais, idsPosts, idsPublicados } from "@/lib/server";
import { SITE_URL } from "@/lib/site";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixas = ["", "/mapa", "/blog", "/podcast", "/busca"].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now }));
  const [pub, posts, ...ofic] = await Promise.all([
    idsPublicados(),
    idsPosts(),
    ...(["event", "space", "agent", "project", "opportunity"] as const).map(async (k) => (await idsOficiais(k)).map((id) => `/oficial/aquiraz/${k}/${id}`)),
  ]);
  return [
    ...fixas,
    ...pub.map((r) => ({ url: `${SITE_URL}/ver/${r.id}`, lastModified: now })),
    ...posts.map((r) => ({ url: `${SITE_URL}/leitura/${r.id}`, lastModified: r.published_at ? new Date(r.published_at) : now })),
    ...ofic.flat().map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now })),
  ];
}
