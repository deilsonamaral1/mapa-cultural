/**
 * Leitura das APIs PÚBLICAS dos Mapas Culturais (Aquiraz e Secult-CE).
 * As chamadas passam pelo proxy do próprio site (/proxy/...), definido em netlify.toml e
 * next.config.mjs, para evitar bloqueio de CORS. Nada aqui grava dados nas instâncias.
 *
 * Como não controlamos o servidor oficial, o código é tolerante: aceita variações no formato
 * da resposta e, se um campo extra for recusado, repete a consulta só com os campos básicos.
 */

export type Kind = "agent" | "space" | "event";
export type SourceKey = "aquiraz" | "estado";

export const SOURCES: Record<SourceKey, { label: string; short: string; proxy: string; site: string }> = {
  aquiraz: {
    label: "Mapa Cultural de Aquiraz",
    short: "Aquiraz",
    proxy: "/proxy/aquiraz",
    site: "https://mapacultural.aquiraz.ce.gov.br",
  },
  estado: {
    label: "Mapa Cultural do Ceará",
    short: "Ceará",
    proxy: "/proxy/estado",
    site: "https://mapacultural.secult.ce.gov.br",
  },
};

export const KINDS: Record<Kind, { label: string; plural: string; path: string; color: string }> = {
  agent: { label: "Agente", plural: "Agentes", path: "agente", color: "#0e7c86" },
  space: { label: "Espaço", plural: "Espaços", path: "espaco", color: "#b7791f" },
  event: { label: "Evento", plural: "Eventos", path: "evento", color: "#b4451f" },
};

export type Item = {
  key: string; // único entre fontes e tipos
  source: SourceKey;
  kind: Kind;
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  areas: string[];
  lat: number | null;
  lng: number | null;
  place: string | null; // nome do espaço (eventos)
  city: string | null;
  startsAt: Date | null; // eventos
  endsAt: Date | null;
  when: string | null; // texto da recorrência vindo do mapa oficial (ex.: "Sábado às 19h")
  url: string; // página oficial da entidade
};

export type FetchResult = { items: Item[]; truncated: boolean };

/* ------------------------------ utilidades ------------------------------ */

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Aceita {latitude,longitude}, [lng,lat] ou "POINT(lng lat)"; descarta o que cai fora do Brasil. */
export function parseLocation(loc: unknown): { lat: number | null; lng: number | null } {
  let lat: number | null = null;
  let lng: number | null = null;
  if (Array.isArray(loc)) {
    lng = num(loc[0]);
    lat = num(loc[1]);
  } else if (loc && typeof loc === "object") {
    const o = loc as Record<string, unknown>;
    lat = num(o.latitude ?? o.lat);
    lng = num(o.longitude ?? o.lng ?? o.lon);
  } else if (typeof loc === "string") {
    const m = loc.match(/(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/);
    if (m) {
      lng = num(m[1]);
      lat = num(m[2]);
    }
  }
  const ok = lat != null && lng != null && lat >= -34 && lat <= 6 && lng >= -75 && lng <= -30;
  return ok ? { lat, lng } : { lat: null, lng: null };
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v.includes(" ") && !v.includes("T") ? v.replace(" ", "T") : v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return toDate(o.date ?? o.datetime ?? o.value ?? null);
  }
  return null;
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function typeName(t: unknown): string | null {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") return txt((t as Record<string, unknown>).name);
  return null;
}

function areasOf(terms: unknown): string[] {
  const a = (terms as Record<string, unknown> | null)?.area;
  return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
}

async function getJSON(url: string, signal?: AbortSignal): Promise<unknown> {
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (!ct.includes("json")) throw new Error("resposta inesperada (não é JSON)");
  return r.json();
}

const qs = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

/* ------------------------------ normalização ------------------------------ */

function base(source: SourceKey, kind: Kind, e: Record<string, any>): Item {
  const loc = parseLocation(e.location);
  return {
    key: `${source}:${kind}:${e.id}`,
    source,
    kind,
    id: Number(e.id),
    name: txt(e.name) ?? "(sem nome)",
    description: txt(e.shortDescription),
    type: typeName(e.type),
    areas: areasOf(e.terms),
    lat: loc.lat,
    lng: loc.lng,
    place: null,
    city: txt(e.En_Municipio),
    startsAt: null,
    endsAt: null,
    when: null,
    url: `${SOURCES[source].site}/${KINDS[kind].path}/${e.id}`,
  };
}

const hhmm = (v: unknown): string | null => {
  const m = txt(v)?.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A data de uma ocorrência fica em `rule` (formato do Mapas Culturais):
 * startsOn "2026-11-08", startsAt "19:00" (hora), endsAt "21:00", frequency "once|daily|weekly|…",
 * until "AAAA-MM-DD" e description (texto legível, ex.: "Sábado às 19h").
 */
function ruleWindow(rule: any): { start: Date | null; end: Date | null; text: string | null } {
  if (!rule || typeof rule !== "object") return { start: null, end: null, text: null };
  const text = txt(rule.description);
  const on = txt(rule.startsOn)?.slice(0, 10) ?? null;
  if (!on) return { start: toDate(rule.startsAt), end: toDate(rule.endsAt), text };

  const until = txt(rule.until)?.slice(0, 10) ?? null;
  const today = ymd(new Date());
  let day = on;
  // evento recorrente já em andamento: considera a ocorrência de hoje
  if (rule.frequency && rule.frequency !== "once" && on < today && (!until || until >= today)) day = today;

  const start = toDate(`${day}T${hhmm(rule.startsAt) ?? "00:00"}`);
  let end = hhmm(rule.endsAt) ? toDate(`${day}T${hhmm(rule.endsAt)}`) : null;
  if (start && end && end < start) end = new Date(end.getTime() + 86400000); // passa da meia-noite
  return { start, end, text };
}

function normEvent(source: SourceKey, e: Record<string, any>): Item {
  const item = base(source, "event", e);
  const occs: any[] = Array.isArray(e.occurrences) ? e.occurrences : [];
  const now = Date.now();
  // próxima ocorrência que ainda não terminou; se não houver, a primeira
  const dated = occs
    .map((o) => ({ o, ...ruleWindow(o?.rule ?? o) }))
    .sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  const next = dated.find((x) => ((x.end ?? x.start)?.getTime() ?? Infinity) >= now) ?? dated[0];
  const occ = next?.o ?? occs[0];
  if (next) {
    item.startsAt = next.start;
    item.endsAt = next.end;
    item.when = next.text;
  }
  const space = occ?.space;
  if (space && typeof space === "object") {
    item.place = txt(space.name);
    const loc = parseLocation(space.location);
    item.lat = loc.lat;
    item.lng = loc.lng;
    item.city = item.city ?? txt(space.En_Municipio);
  }
  return item;
}

/* ------------------------------ consulta ------------------------------ */

// Do mais completo ao mais simples: se o servidor recusar algum campo, tenta o próximo.
// Para eventos, o formato `occurrences.{id,space.{...},rule}` é o da documentação oficial.
const SELECT: Record<Kind, string[]> = {
  agent: ["id,name,shortDescription,location,type,terms,En_Municipio", "id,name,shortDescription,location", "id,name"],
  space: ["id,name,shortDescription,location,type,terms,En_Municipio", "id,name,shortDescription,location", "id,name"],
  event: [
    "id,name,shortDescription,terms,occurrences.{id,space.{id,name,location,En_Municipio},rule}",
    "id,name,shortDescription,occurrences.{id,space.{name,location},rule}",
    "id,name,shortDescription",
  ],
};

const PAGE = 400;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type FetchOpts = { q?: string; municipio?: string; signal?: AbortSignal };

async function fetchRows(
  source: SourceKey,
  kind: Kind,
  select: string,
  page: number,
  { q, municipio, signal }: FetchOpts,
): Promise<any[]> {
  const root = `${SOURCES[source].proxy}/api/${kind}`;
  let url: string;
  if (kind === "event") {
    const from = new Date();
    const to = new Date(Date.now() + 90 * 86400000);
    url = `${root}/findByLocation?${qs({
      "@select": select,
      "@from": isoDay(from),
      "@to": isoDay(to),
      "@limit": PAGE,
      "@page": page,
      "@keyword": q,
    })}`;
  } else {
    url = `${root}/find?${qs({
      "@select": select,
      "@order": "name ASC",
      "@limit": PAGE,
      "@page": page,
      "@keyword": q,
      status: "EQ(1)",
      En_Municipio: municipio ? `LIKE(*${municipio}*)` : undefined,
    })}`;
  }
  const data = await getJSON(url, signal);
  if (!Array.isArray(data)) throw new Error("formato de resposta inesperado");
  return data;
}

/** Busca um tipo de entidade em uma instância. Aquiraz é lida inteira (até 5 páginas); o estado, só a 1ª página. */
export async function fetchKind(source: SourceKey, kind: Kind, opts: FetchOpts): Promise<FetchResult> {
  const maxPages = source === "aquiraz" ? 5 : 1;
  const rows: any[] = [];
  const chain = SELECT[kind];
  let level = 0;
  let truncated = false;

  for (let page = 1; page <= maxPages; page++) {
    let chunk: any[];
    for (;;) {
      try {
        chunk = await fetchRows(source, kind, chain[level], page, opts);
        break;
      } catch (err) {
        if (opts.signal?.aborted || level >= chain.length - 1) throw err;
        level++; // campo recusado pelo servidor: tenta a versão mais simples
      }
    }
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    if (page === maxPages) truncated = true;
  }

  const items = rows
    .filter((e) => e && e.id != null)
    .map((e) => (kind === "event" ? normEvent(source, e) : base(source, kind, e)));
  return { items, truncated };
}

/* ------------------------------ apresentação ------------------------------ */

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function fmtDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
