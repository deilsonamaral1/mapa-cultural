"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { fetchLocal } from "@/lib/local";
import { fetchKind, type Item } from "@/lib/mapas";

const month = (d: Date) => d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
const hour = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Próximos eventos de Aquiraz: lidos ao vivo do mapa oficial e dos cadastros aprovados neste site. */
export default function UpcomingEvents() {
  const [events, setEvents] = useState<Item[] | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      const [a, b] = await Promise.allSettled([fetchKind("aquiraz", "event", {}), fetchLocal("event", {})]);
      const all = [a, b].flatMap((r) => (r.status === "fulfilled" ? r.value.items : []));
      const now = Date.now();
      const next = all
        .filter((e) => e.startsAt && (e.endsAt ?? e.startsAt).getTime() >= now - 3600000)
        .sort((x, y) => x.startsAt!.getTime() - y.startsAt!.getTime())
        .slice(0, 6);
      if (!off) setEvents(next);
    })();
    return () => {
      off = true;
    };
  }, []);

  if (events === null) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando eventos">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </ul>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-display text-lg font-semibold">Nenhum evento marcado para os próximos dias</p>
        <p className="mt-1 text-sm text-slate-600">Abra o mapa para ver tudo o que já foi cadastrado em Aquiraz e no Ceará.</p>
        <a href="/mapa?tab=event" className="mt-4 inline-block rounded-full bg-sea px-5 py-2.5 text-sm font-semibold text-white hover:bg-sea-deep">
          Abrir o mapa de eventos
        </a>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => {
        const d = e.startsAt!;
        return (
          <li key={e.key}>
            <a
              href={e.entryId ? `/ver?id=${e.entryId}` : `/oficial?s=${e.source}&k=event&id=${e.id}`}
              className="group flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="grid h-16 w-16 shrink-0 place-content-center rounded-xl bg-sea text-center text-white">
                <span className="font-display text-2xl font-bold leading-none">{String(d.getDate()).padStart(2, "0")}</span>
                <span className="mt-0.5 text-xs font-medium text-white/75">{month(d)}</span>
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug group-hover:text-brand">{e.name}</h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon name="clock" className="h-4 w-4 shrink-0" />
                  {e.when ?? hour(d)}
                </p>
                {(e.place || e.city) && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                    <Icon name="pin" className="h-4 w-4 shrink-0" />
                    <span className="truncate">{[e.place, e.city].filter(Boolean).join(", ")}</span>
                  </p>
                )}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
