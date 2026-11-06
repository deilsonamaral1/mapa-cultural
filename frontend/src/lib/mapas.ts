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
    url: `${SOURCES[source].site}/${KINDS[kind].path}/${e.id}`,
  };
}

function normEvent(source: SourceKey, e: Record<string, any>): Item {
  const item = base(source, "event", e);
  const occs: any[] = Array.isArray(e.occurrences) ? e.occurrences : [];
  const now = Date.now();
  // próxima ocorrência que ainda não terminou; se não houver, a primeira
  const dated = occs
    .map((o) => ({ o, s: toDate(o.startsAt ?? o.starts ?? o.startsOn), f: toDate(o.endsAt ?? o.ends ?? o.endsOn) }))
    .sort((a, b) => (a.s?.getTime() ?? Infinity) - (b.s?.getTime() ?? Infinity));
  const next = dated.find((x) => ((x.f ?? x.s)?.getTime() ?? Infinity) >= now) ?? dated[0];
  const occ = next?.o ?? occs[0];
  if (next) {
    item.startsAt = next.s;
    item.endsAt = next.f;
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

const SELECT: Record<Kind, { full: string; basic: string }> = {
  agent: { full: "id,name,shortDescription,location,type,terms,En_Municipio", basic: "id,name,shortDescription,location" },
  space: { full: "id,name,shortDescription,location,type,terms,En_Municipio", basic: "id,name,shortDescription,location" },
  event: { full: "id,name,shortDescription,occurrences,terms", basic: "id,name,shortDescription,occurrences" },
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
      En_Municipio: municipio ? `ILIKE(*${municipio}*)` : undefined,
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
  let select = SELECT[kind].full;
  let truncated = false;

  for (let page = 1; page <= maxPages; page++) {
    let chunk: any[];
    try {
      chunk = await fetchRows(source, kind, select, page, opts);
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      // campo extra recusado? tenta de novo só com o básico (e sem filtro de município)
      if (select !== SELECT[kind].basic) {
        select = SELECT[kind].basic;
        chunk = await fetchRows(source, kind, select, page, { ...opts, municipio: undefined });
      } else {
        throw err;
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
