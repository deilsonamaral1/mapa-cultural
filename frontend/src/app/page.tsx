"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KINDS, SOURCES, distanceKm, fetchKind, fmtDate, type Item, type Kind, type SourceKey } from "@/lib/mapas";
import type { Focus } from "@/components/MapView";

// Leaflet usa `window`: só carrega no navegador
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-gray-500">Carregando mapa…</div>,
});

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz";
const TABS: Kind[] = ["event", "agent", "space"];
const PERIODS = [
  { key: "all", label: "Próximos 90 dias", days: 90 },
  { key: "today", label: "Hoje", days: 1 },
  { key: "week", label: "7 dias", days: 7 },
  { key: "month", label: "30 dias", days: 30 },
] as const;
const PAGE_SIZE = 100;

type Status = { state: "loading" | "ok" | "error"; count?: number; error?: string; truncated?: boolean };

export default function Home() {
  const [tab, setTab] = useState<Kind>("event");
  const [q, setQ] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [sources, setSources] = useState<Record<SourceKey, boolean>>({ aquiraz: true, estado: true });
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Partial<Record<SourceKey, Status>>>({});
  const [retry, setRetry] = useState(0);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [view, setView] = useState<"list" | "map">("list"); // só vale no celular

  const active = (Object.keys(sources) as SourceKey[]).filter((k) => sources[k]);
  const fitKey = `${tab}|${q}|${municipio}|${active.join(",")}`;

  // busca nas instâncias oficiais (com pequena espera enquanto a pessoa digita)
  useEffect(() => {
    const ctrl = new AbortController();
    setStatus(Object.fromEntries(active.map((k) => [k, { state: "loading" } as Status])));
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(
        active.map((k) => fetchKind(k, tab, { q: q.trim(), municipio: k === "estado" ? municipio.trim() : "", signal: ctrl.signal })),
      );
      if (ctrl.signal.aborted) return;
      const all: Item[] = [];
      const st: Partial<Record<SourceKey, Status>> = {};
      results.forEach((r, i) => {
        const k = active[i];
        if (r.status === "fulfilled") {
          all.push(...r.value.items);
          st[k] = { state: "ok", count: r.value.items.length, truncated: r.value.truncated || (k === "estado" && r.value.items.length >= 400) };
        } else {
          st[k] = { state: "error", error: r.reason instanceof Error ? r.reason.message : "erro desconhecido" };
        }
      });
      setItems(all);
      setStatus(st);
      setShown(PAGE_SIZE);
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, municipio, sources, retry]);

  // período (eventos), ordenação por data / proximidade / nome
  const visible = useMemo(() => {
    let list = items;
    if (tab === "event" && period !== "all") {
      const days = PERIODS.find((p) => p.key === period)!.days;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + days * 86400000;
      list = list.filter((it) => it.startsAt && it.startsAt.getTime() < end && (it.endsAt ?? it.startsAt).getTime() >= Date.now() - 3600000);
    }
    const dist = (it: Item) => (me && it.lat != null && it.lng != null ? distanceKm(me.lat, me.lng, it.lat, it.lng) : Infinity);
    return [...list].sort((a, b) => {
      if (me) return dist(a) - dist(b);
      if (tab === "event") return (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity);
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [items, tab, period, me]);

  const loading = active.some((k) => status[k]?.state === "loading");
  const failed = active.filter((k) => status[k]?.state === "error");
  const truncated = active.some((k) => status[k]?.truncated);
  const withoutPin = visible.filter((it) => it.lat == null).length;

  function toggleSource(k: SourceKey) {
    setSources((s) => (s[k] && active.length === 1 ? s : { ...s, [k]: !s[k] })); // sempre deixa uma ligada
  }

  function locate() {
    setGeoError("");
    if (!navigator.geolocation) return setGeoError("Seu navegador não permite localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
        setView("map");
      },
      () => setGeoError("Não consegui sua localização. Verifique a permissão do navegador."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  function pick(it: Item) {
    setSelected(it.key);
    if (it.lat != null) {
      setFocus((f) => ({ key: it.key, n: (f?.n ?? 0) + 1 }));
      setView("map");
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white shadow">
        <h1 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-white/20">📍</span>
          Mapa Cultural · {city}
        </h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cadastro" className="rounded-full bg-white px-3 py-1 font-medium text-brand-dark hover:bg-brand-soft">
            Cadastre-se
          </Link>
          <a href={`${SOURCES.aquiraz.site}/autenticacao/`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            Entrar
          </a>
        </nav>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[400px_1fr]">
        <aside className={`${view === "list" ? "flex" : "hidden"} min-h-0 flex-col border-r md:flex`}>
          <div className="space-y-3 p-4">
            <div className="flex gap-1 rounded-lg bg-brand-soft p-1" role="tablist">
              {TABS.map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === k ? "bg-brand text-white shadow-sm" : "text-brand-dark hover:bg-white/60"}`}
                >
                  {KINDS[k].plural}
                </button>
              ))}
            </div>

            <input placeholder={`Buscar ${KINDS[tab].plural.toLowerCase()} por nome…`} value={q} onChange={(e) => setQ(e.target.value)} />

            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(SOURCES) as SourceKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => toggleSource(k)}
                  aria-pressed={sources[k]}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${sources[k] ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-600"}`}
                >
                  {SOURCES[k].short}
                </button>
              ))}
              <button onClick={locate} className="ml-auto rounded-full border border-blue-600 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                📍 Perto de mim
              </button>
            </div>
            {geoError && <p className="text-xs text-red-600">{geoError}</p>}

            {sources.estado && (
              <input placeholder="Município do Ceará (ex.: Fortaleza)" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
            )}

            {tab === "event" && (
              <div className="flex flex-wrap gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-full px-2.5 py-1 text-xs ${period === p.key ? "bg-ink text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {failed.map((k) => (
            <div key={k} className="mx-4 mb-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Não foi possível carregar o <strong>{SOURCES[k].label}</strong> ({status[k]?.error}).{" "}
              <button onClick={() => setRetry((n) => n + 1)} className="font-medium underline">Tentar de novo</button>
            </div>
          ))}

          <div className="flex items-center justify-between border-y bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <span>{loading ? "Carregando…" : `${visible.length} resultado${visible.length === 1 ? "" : "s"}`}{me ? " · por distância" : ""}</span>
            {me && (
              <button onClick={() => setMe(null)} className="underline">limpar localização</button>
            )}
          </div>
          {!loading && truncated && (
            <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Mostrando os primeiros resultados. Use a busca ou o município para refinar.
            </p>
          )}
          {!loading && withoutPin > 0 && (
            <p className="px-4 py-1.5 text-xs text-gray-500">{withoutPin} sem localização no mapa.</p>
          )}

          <ul className="flex-1 divide-y overflow-y-auto">
            {!loading && failed.length === 0 && visible.length === 0 && <li className="p-4 text-sm text-gray-500">Nada encontrado.</li>}
            {visible.slice(0, shown).map((it) => {
              const km = me && it.lat != null && it.lng != null ? distanceKm(me.lat, me.lng, it.lat, it.lng) : null;
              return (
                <li key={it.key}>
                  <button
                    onClick={() => pick(it)}
                    className={`block w-full px-4 py-3 text-left hover:bg-brand-soft/60 ${selected === it.key ? "bg-brand-soft" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KINDS[it.kind].color }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{it.name}</div>
                        {it.startsAt && <div className="text-sm font-medium text-brand-dark">{fmtDate(it.startsAt)}</div>}
                        {(it.place || it.city || it.type) && (
                          <div className="text-sm text-gray-600">{[it.place, it.city, it.type].filter(Boolean).join(" · ")}</div>
                        )}
                        {it.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{it.description}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5">{SOURCES[it.source].short}</span>
                          {it.areas.slice(0, 3).map((a) => (
                            <span key={a} className="rounded bg-brand-soft px-1.5 py-0.5 text-brand-dark">{a}</span>
                          ))}
                          {km != null && <span>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</span>}
                          {it.lat == null && <span>sem localização</span>}
                          <a href={it.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto font-medium text-brand-dark hover:underline">
                            Ver no mapa oficial ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {visible.length > shown && (
              <li className="p-3 text-center">
                <button onClick={() => setShown((n) => n + PAGE_SIZE)} className="rounded border px-4 py-1.5 text-sm text-brand-dark hover:bg-brand-soft">
                  Mostrar mais ({visible.length - shown})
                </button>
              </li>
            )}
          </ul>
        </aside>

        <main className={`${view === "map" ? "block" : "hidden"} relative min-h-[300px] md:block`}>
          <MapView
            items={visible}
            fitKey={fitKey}
            focus={focus}
            me={me}
            visible={view === "map"}
            onMarkerClick={(key) => setSelected(key)}
          />
        </main>
      </div>

      {/* alternar lista/mapa no celular */}
      <button
        onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
        className="fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg md:hidden"
      >
        {view === "list" ? "🗺️ Ver mapa" : "☰ Ver lista"}
      </button>
    </div>
  );
}
