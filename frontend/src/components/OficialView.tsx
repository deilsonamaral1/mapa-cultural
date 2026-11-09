"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Media from "@/components/Media";
import ShareBar from "@/components/ShareBar";
import SiteHeader from "@/components/SiteHeader";
import { KINDS, SOURCES, fetchDetail, fmtDate, type Detail, type Kind, type OfficialKey } from "@/lib/mapas";

const safeUrl = (v?: string | null) => {
  if (!v) return null;
  const s = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : null;
  return s && /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
};

/** Cadastro vindo de um Mapa Cultural oficial, mostrado dentro deste site (dados lidos ao vivo). */
export default function OficialView({ s: source0, k: kind0, id: id0 }: { s: OfficialKey; k: Kind; id: number }) {
  const [d, setD] = useState<Detail | null>(null);
  const [kind, setKind] = useState<Kind>(kind0);
  const [source, setSource] = useState<OfficialKey>(source0);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");

  useEffect(() => {
    const s = source0, k = kind0, id = id0;
    setSource(s);
    setKind(k);
    fetchDetail(s, k, id)
      .then((r) => {
        setD(r);
        setState(r ? "ok" : "missing");
      })
      .catch(() => setState("error"));
  }, [source0, kind0, id0]);

  const k = KINDS[kind];
  const it = d?.item;
  const site = safeUrl(d?.site);
  const registration = kind === "project" || kind === "opportunity";
  const where = it ? [it.place, d?.address, it.city].filter(Boolean).join(", ") : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/mapa?tab=${kind}`} className="text-sm font-medium text-brand hover:underline">← Voltar para {k.plural.toLowerCase()}</Link>

        {state === "loading" && <p className="mt-6 text-slate-500">Carregando…</p>}
        {state === "missing" && <p className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-slate-600">Não encontramos este cadastro. Ele pode ter sido removido do mapa oficial.</p>}
        {state === "error" && <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar agora. Tente de novo em instantes.</p>}

        {state === "ok" && d && it && (
          <article className="mt-4 space-y-5">
            <header>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: k.color }}>{k.label}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{SOURCES[source].short}</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold leading-tight">{it.name}</h1>
              {registration && (it.startsAt || it.endsAt) && (
                <p className="mt-1 font-medium text-slate-700">
                  Inscrições: {it.startsAt ? fmtDate(it.startsAt) : "—"} até {it.endsAt ? fmtDate(it.endsAt) : "—"}
                </p>
              )}
              {!registration && (it.when || it.startsAt) && <p className="mt-1 font-medium text-slate-700">{it.when ?? fmtDate(it.startsAt)}</p>}
              {where && (
                <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                  <Icon name="pin" className="h-4 w-4 shrink-0" />
                  {where}
                </p>
              )}
            </header>

            <ShareBar title={it.name} kind={kind}
              evento={kind === "event" && it.startsAt ? { title: it.name, start: it.startsAt, end: it.endsAt, place: where, details: it.description } : null} />

            <Media photos={d.photos} videos={d.videoIds} />

            {(d.longDescription || it.description) && (
              <p className="whitespace-pre-line text-slate-800">{d.longDescription ?? it.description}</p>
            )}

            {(it.type || it.areas.length > 0) && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {it.type && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{it.type}</span>}
                {it.areas.map((a) => <span key={a} className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-dark">{a}</span>)}
              </div>
            )}

            <div className="space-y-1 text-sm text-slate-700">
              {d.email && <p><strong>E-mail:</strong> {d.email}</p>}
              {d.phone && <p><strong>Telefone:</strong> {d.phone}</p>}
              {site && <p><a className="font-semibold text-brand underline" href={site} target="_blank" rel="noopener noreferrer">Site ou rede social ↗</a></p>}
              {it.lat != null && it.lng != null && (
                <p><a className="font-semibold text-brand underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${it.lat}&mlon=${it.lng}#map=17/${it.lat}/${it.lng}`}>Ver no mapa ↗</a></p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Os dados vêm do {SOURCES[source].label} e são atualizados automaticamente.{" "}
              {registration ? (
                <>
                  Para <strong>se inscrever</strong>, é preciso entrar no mapa oficial:{" "}
                  <a className="inline-flex items-center gap-1 font-semibold text-brand underline" href={it.url} target="_blank" rel="noopener noreferrer">
                    abrir inscrição <Icon name="ext" className="h-3.5 w-3.5" />
                  </a>
                </>
              ) : (
                <a className="inline-flex items-center gap-1 font-semibold text-brand underline" href={it.url} target="_blank" rel="noopener noreferrer">
                  Ver no mapa oficial <Icon name="ext" className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
