"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import SiteHeader from "@/components/SiteHeader";
import { fetchLocal } from "@/lib/local";
import {
  KINDS, KIND_ORDER, SOURCES, SUBMIT_KINDS, distanceKm, fetchKind, fmtDate, fmtDay,
  type Item, type Kind, type SourceKey, type SubmitKind,
} from "@/lib/mapas";
import type { Focus } from "@/components/MapView";

// Leaflet usa `window`: só carrega no navegador
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-100 text-slate-500">Carregando mapa…</div>,
});

const PERIODS = [
  { key: "all", label: "Próximos 90 dias", days: 90 },
  { key: "today", label: "Hoje", days: 1 },
  { key: "week", label: "7 dias", days: 7 },
  { key: "month", label: "30 dias", days: 30 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const PAGE_SIZE = 100;
const isSubmitKind = (k: Kind): k is SubmitKind => (SUBMIT_KINDS as Kind[]).includes(k);
const isOpen = (it: Item) => !it.endsAt || it.endsAt.getTime() >= Date.now();

type Status = { state: "loading" | "ok" | "error"; count?: number; error?: string; truncated?: boolean };

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-medium transition ${on ? "bg-sea text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;

export default function MapaPage() {
  const [tab, setTab] = useState<Kind>("event");
  const [q, setQ] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [sources, setSources] = useState<Record<SourceKey, boolean>>({ aquiraz: true, estado: true, local: true });
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [onlyOpen, setOnlyOpen] = useState(true); // oportunidades: só com inscrições abertas
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Partial<Record<SourceKey, Status>>>({});
  const [retry, setRetry] = useState(0);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [view, setView] = useState<"list" | "map">("list"); // só vale no celular
  const [ready, setReady] = useState(false);

  // vindo da tela inicial: /mapa?tab=space&q=teatro&period=week (sem useSearchParams, que exigiria Suspense)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab") as Kind | null;
    if (t && KIND_ORDER.includes(t)) setTab(t);
    const s = p.get("q");
    if (s) setQ(s);
    const per = p.get("period") as PeriodKey | null;
    if (per && PERIODS.some((x) => x.key === per)) setPeriod(per);
    setReady(true);
  }, []);

  const listOnly = tab === "project" || tab === "opportunity"; // não têm ponto no mapa
  const sourceKeys = (Object.keys(SOURCES) as SourceKey[]).filter((k) => k !== "local" || isSubmitKind(tab));
  const picked = sourceKeys.filter((k) => sources[k]);
  const active = picked.length ? picked : sourceKeys;
  const useMunicipio = active.includes("estado") && (tab === "agent" || tab === "space");
  const fitKey = `${tab}|${q}|${municipio}|${active.join(",")}`;

  // busca nas instâncias oficiais (com pequena espera enquanto a pessoa digita)
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    setStatus(Object.fromEntries(active.map((k) => [k, { state: "loading" } as Status])));
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(
        active.map((k) =>
          k === "local"
            ? fetchLocal(tab as SubmitKind, { q: q.trim() })
            : fetchKind(k, tab, { q: q.trim(), municipio: k === "estado" && useMunicipio ? municipio.trim() : "", signal: ctrl.signal }),
        ),
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
  }, [ready, tab, q, municipio, sources, retry]);

  // período (eventos), inscrições abertas (oportunidades) e ordenação
  const visible = useMemo(() => {
    let list = items;
    if (tab === "event" && period !== "all") {
      const days = PERIODS.find((p) => p.key === period)!.days;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + days * 86400000;
      list = list.filter((it) => it.startsAt && it.startsAt.getTime() < end && (it.endsAt ?? it.startsAt).getTime() >= Date.now() - 3600000);
    }
    if (tab === "opportunity" && onlyOpen) list = list.filter(isOpen);

    const dist = (it: Item) => (me && it.lat != null && it.lng != null ? distanceKm(me.lat, me.lng, it.lat, it.lng) : Infinity);
    return [...list].sort((a, b) => {
      if (me) return dist(a) - dist(b);
      if (tab === "event") return (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity);
      if (listOnly) {
        // abertas primeiro (a que fecha antes vem antes), depois as encerradas, depois as sem prazo
        const rank = (it: Item) => (!it.endsAt ? 2 : isOpen(it) ? 0 : 1);
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) return a.endsAt!.getTime() - b.endsAt!.getTime();
        if (ra === 1) return b.endsAt!.getTime() - a.endsAt!.getTime();
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [items, tab, period, onlyOpen, me, listOnly]);

  const loading = active.some((k) => status[k]?.state === "loading");
  const failed = active.filter((k) => status[k]?.state === "error");
  const truncated = active.some((k) => status[k]?.truncated);
  const pins = visible.filter((it) => it.lat != null).length;
  const withoutPin = visible.length - pins;

  function toggleSource(k: SourceKey) {
    const next = { ...sources, [k]: !sources[k] };
    if (!sourceKeys.some((x) => next[x])) return; // sempre deixa uma fonte ligada
    setSources(next);
  }

  function locate() {
    setGeoError("");
    if (!navigator.geolocation) return setGeoError("Seu navegador não permite localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
        setView("map");
      },
      () => setGeoError("Não consegui sua localização. Permita o acesso no navegador e tente de novo."),
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

  function when(it: Item) {
    if (it.kind === "event") {
      if (it.startsAt) return { text: `${fmtDate(it.startsAt)}${it.when ? `, ${it.when}` : ""}`, tone: "text-brand" };
      return it.when ? { text: it.when, tone: "text-brand" } : null;
    }
    if ((it.kind === "opportunity" || it.kind === "project") && it.endsAt) {
      return isOpen(it)
        ? { text: `Inscrições até ${fmtDay(it.endsAt)}`, tone: "text-emerald-700" }
        : { text: `Inscrições encerradas em ${fmtDay(it.endsAt)}`, tone: "text-slate-500" };
    }
    return null;
  }

  const panel = (
    <>
      <div className="space-y-3 p-4">
        <div role="tablist" aria-label="Categoria" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => { setTab(k); setSelected(null); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                tab === k ? "text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              style={tab === k ? { background: KINDS[k].color } : undefined}
            >
              <Icon name={k} className="h-4 w-4" />
              {KINDS[k].plural}
            </button>
          ))}
        </div>

        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input
            className="!pl-10"
            placeholder={`Buscar ${KINDS[tab].plural.toLowerCase()} por nome`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar por nome"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sourceKeys.map((k) => (
            <button key={k} onClick={() => toggleSource(k)} aria-pressed={active.includes(k)} className={chip(active.includes(k))}>
              {SOURCES[k].short}
            </button>
          ))}
          {!listOnly && (
            <button
              onClick={locate}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-sea/30 px-3 py-1.5 text-xs font-medium text-sea hover:bg-brand-soft"
            >
              <Icon name="locate" className="h-4 w-4" />
              Perto de mim
            </button>
          )}
        </div>
        {geoError && <p role="alert" className="text-xs text-red-600">{geoError}</p>}

        {useMunicipio && <input placeholder="Município do Ceará (ex.: Fortaleza)" value={municipio} onChange={(e) => setMunicipio(e.target.value)} aria-label="Município" />}

        {tab === "event" && (
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)} aria-pressed={period === p.key} className={chip(period === p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        {tab === "opportunity" && (
          <button onClick={() => setOnlyOpen((v) => !v)} aria-pressed={onlyOpen} className={chip(onlyOpen)}>
            Só com inscrições abertas
          </button>
        )}
      </div>

      {failed.map((k) => (
        <div key={k} role="alert" className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Não foi possível carregar o <strong>{SOURCES[k].label}</strong> ({status[k]?.error}).{" "}
          <button onClick={() => setRetry((n) => n + 1)} className="font-semibold underline">Tentar de novo</button>
        </div>
      ))}

      <div className="flex items-center justify-between border-y border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <span aria-live="polite">
          {loading ? "Carregando…" : `${visible.length} resultado${visible.length === 1 ? "" : "s"}`}
          {me ? ", do mais perto ao mais longe" : ""}
        </span>
        {me && <button onClick={() => setMe(null)} className="font-medium underline">Limpar localização</button>}
      </div>
      {!loading && truncated && (
        <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">Mostrando os primeiros resultados. Use a busca ou o município para refinar.</p>
      )}
      {!loading && !listOnly && withoutPin > 0 && <p className="px-4 py-1.5 text-xs text-slate-500">{withoutPin} sem localização no mapa.</p>}

      <ul className={`${listOnly ? "" : "min-h-0 flex-1 overflow-y-auto"} space-y-3 p-4`}>
        {!loading && failed.length === 0 && visible.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            Nada encontrado. Tente outra palavra ou outra categoria.
          </li>
        )}

        {visible.slice(0, shown).map((it) => {
          const km = me && it.lat != null && it.lng != null ? distanceKm(me.lat, me.lng, it.lat, it.lng) : null;
          const w = when(it);
          const where = [it.place, it.city].filter(Boolean).join(", ");
          return (
            <li key={it.key}>
              <article
                onClick={() => pick(it)}
                className={`cursor-pointer rounded-2xl border bg-white p-4 transition hover:shadow-lift ${selected === it.key ? "border-brand ring-2 ring-brand/25" : "border-slate-200"}`}
              >
                <div className="flex gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: KINDS[it.kind].color }}>
                    <Icon name={it.kind} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-semibold leading-snug">
                      <button onClick={(e) => { e.stopPropagation(); pick(it); }} className="text-left hover:text-brand">{it.name}</button>
                    </h3>
                    {w && <p className={`mt-1 text-sm font-medium ${w.tone}`}>{w.text}</p>}
                    {(where || it.type) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                        {where && <Icon name="pin" className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{[where, it.type].filter(Boolean).join(", ")}</span>
                      </p>
                    )}
                    {it.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{it.description}</p>}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{SOURCES[it.source].short}</span>
                      {it.areas.slice(0, 3).map((a) => (
                        <span key={a} className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">{a}</span>
                      ))}
                      {km != null && <span>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</span>}
                      {!listOnly && it.lat == null && <span>sem localização</span>}
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto flex items-center gap-1 font-semibold text-brand hover:underline"
                        >
                          {listOnly ? "Ver detalhes e se inscrever" : "Ver no mapa oficial"}
                          <Icon name="ext" className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </li>
          );
        })}

        {visible.length > shown && (
          <li className="text-center">
            <button onClick={() => setShown((n) => n + PAGE_SIZE)} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-brand hover:bg-brand-soft">
              Mostrar mais ({visible.length - shown})
            </button>
          </li>
        )}
      </ul>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      <SiteHeader />

      {listOnly ? (
        // projetos e oportunidades: sem ponto no mapa, então a lista usa a largura toda
        <div className="min-h-0 flex-1 overflow-y-auto bg-cal">
          <div className="mx-auto max-w-3xl">{panel}</div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 md:grid-cols-[440px_1fr]">
          <aside className={`${view === "list" ? "flex" : "hidden"} min-h-0 flex-col border-r border-slate-200 bg-cal md:flex`}>{panel}</aside>

          <main className={`${view === "map" ? "block" : "hidden"} relative min-h-[300px] md:block`}>
            <MapView items={visible} fitKey={fitKey} focus={focus} me={me} visible={view === "map"} onMarkerClick={(key) => setSelected(key)} />
            {!loading && (
              <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-lift">
                {pins} {pins === 1 ? "ponto" : "pontos"} no mapa
              </div>
            )}
          </main>
        </div>
      )}

      {/* alternar lista/mapa no celular */}
      {!listOnly && (
        <button
          onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
          className="fixed bottom-5 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-sea px-5 py-3 text-sm font-semibold text-white shadow-lift md:hidden"
        >
          <Icon name={view === "list" ? "map" : "list"} className="h-[18px] w-[18px]" />
          {view === "list" ? "Ver mapa" : "Ver lista"}
        </button>
      )}
    </div>
  );
}
