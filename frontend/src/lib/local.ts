import { photoUrls, youtubeIds } from "@/lib/media";
import { T, rowToEntry, supabase } from "@/lib/supabase";
import type { FetchResult, Item, SubmitKind } from "@/lib/mapas";

type Doc = Record<string, any>;

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const date = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Cadastros deste site já APROVADOS (tabela pública `mc_publicados` no Supabase). */
export async function fetchLocal(kind: SubmitKind, opts: { q?: string }): Promise<FetchResult> {
  const r = await supabase.from(T.publicados).select("id, data", { count: "exact" }).eq("kind", kind).limit(500);
  if (r.error) throw r.error;
  const q = opts.q?.trim().toLowerCase();
  const now = Date.now();

  const items: Item[] = [];
  for (const row of r.data ?? []) {
    const d = rowToEntry(row) as unknown as Doc;
    const name = txt(d.name) ?? "(sem nome)";
    if (q && !name.toLowerCase().includes(q)) continue;

    const startsAt = date(d.startsAt);
    const endsAt = date(d.endsAt);
    // esconde evento que já terminou (sem horário de fim, vale até 3 h depois do início)
    if (kind === "event" && startsAt && (endsAt ?? new Date(startsAt.getTime() + 3 * 3600000)).getTime() < now) continue;

    items.push({
      key: `local:${kind}:${d.id}`,
      source: "local",
      kind,
      id: 0,
      name,
      description: txt(d.shortDescription),
      type: txt(d.type),
      areas: Array.isArray(d.areas) ? d.areas.filter((x: unknown): x is string => typeof x === "string") : [],
      lat: num(d.lat),
      lng: num(d.lng),
      place: txt(d.place),
      city: txt(d.city),
      startsAt,
      endsAt,
      when: null,
      site: txt(d.site),
      contact: txt(d.contact),
      url: "",
      photos: photoUrls(d.photos),
      videos: youtubeIds(d.videos),
      entryId: String(d.id),
    });
  }
  return { items, truncated: (r.count ?? 0) > 500 };
}
