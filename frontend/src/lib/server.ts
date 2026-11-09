// Leituras feitas no SERVIDOR (para títulos e pré-visualizações de links e para o sitemap).
// Usam só a chave pública e as mesmas regras de acesso do site: nada privado passa por aqui.
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase";
import { SOURCES, type Kind, type OfficialKey } from "@/lib/mapas";
import { photoUrls } from "@/lib/media";

export type Meta = { title: string; description: string | null; image: string | null };

const clip = (v: unknown, n = 200): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? (t.length > n ? t.slice(0, n - 1) + "…" : t) : null;
};

async function rest(path: string, revalidate = 600): Promise<any[] | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, next: { revalidate } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

export async function metaEntrada(id: string): Promise<Meta | null> {
  const rows = await rest(`mc_publicados?id=eq.${id}&select=data`);
  const d = rows?.[0]?.data;
  if (!d || typeof d !== "object") return null;
  return { title: clip(d.name, 100) ?? "Cadastro", description: clip(d.shortDescription), image: photoUrls(d.photos)[0] ?? null };
}

export async function metaPost(id: string): Promise<Meta | null> {
  const rows = await rest(`mc_posts?id=eq.${id}&status=eq.published&select=title,summary,cover`);
  const r = rows?.[0];
  if (!r) return null;
  return { title: clip(r.title, 100) ?? "Publicação", description: clip(r.summary), image: typeof r.cover === "string" ? r.cover : null };
}

export async function metaOficial(source: OfficialKey, kind: Kind, id: number): Promise<Meta | null> {
  const root = `${SOURCES[source].site}/api/${kind}/findOne`;
  for (const files of [true, false]) {
    try {
      const q = `id=EQ(${id})&@select=id,name,shortDescription${files ? "&@files=(avatar.avatarBig,gallery):url" : ""}`;
      const r = await fetch(`${root}?${q}`, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
      if (!r.ok) continue;
      const e = await r.json();
      if (!e || typeof e !== "object" || !e.name) continue;
      let image: string | null = null;
      for (const [k, v] of Object.entries(e as Record<string, any>)) {
        if (!k.startsWith("@files")) continue;
        const f = Array.isArray(v) ? v[0] : v;
        if (f && typeof f.url === "string" && f.url.startsWith(`${SOURCES[source].site}/`)) {
          image = f.url;
          break;
        }
      }
      return { title: clip(e.name, 100) ?? "Cadastro", description: clip(e.shortDescription), image };
    } catch {
      /* tenta a versão simples */
    }
  }
  return null;
}

export async function idsPublicados(): Promise<{ id: string }[]> {
  return ((await rest("mc_publicados?select=id&limit=1000", 3600)) ?? []).filter((r) => typeof r.id === "string");
}

export async function idsPosts(): Promise<{ id: string; published_at: string | null }[]> {
  return ((await rest("mc_posts?status=eq.published&select=id,published_at&limit=1000", 3600)) ?? []).filter((r) => typeof r.id === "string");
}

export async function idsOficiais(kind: Kind): Promise<number[]> {
  try {
    const url =
      kind === "event"
        ? `${SOURCES.aquiraz.site}/api/event/findByLocation?@select=id&@from=${new Date().toISOString().slice(0, 10)}&@to=${new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)}&@limit=500`
        : `${SOURCES.aquiraz.site}/api/${kind}/find?@select=id&status=EQ(1)&@limit=1000`;
    const r = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 86400 } });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j.map((x) => Number(x?.id)).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}
