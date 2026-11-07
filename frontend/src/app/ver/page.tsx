"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Media from "@/components/Media";
import SiteHeader from "@/components/SiteHeader";
import { photoUrls, youtubeIds } from "@/lib/media";
import { KINDS, fmtDate } from "@/lib/mapas";
import { T, errMsg, rowToEntry, supabase, type EntryData } from "@/lib/supabase";

const safeUrl = (v?: string | null) => {
  if (!v) return null;
  const s = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : null;
  return s && /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
};

/** Página de um cadastro publicado neste site: descrição, fotos e vídeos do YouTube. */
export default function VerPage() {
  const [e, setE] = useState<(EntryData & { id: string }) | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return setState("missing");
    supabase.from(T.publicados).select("id, data").eq("id", id).maybeSingle().then((r) => {
      if (r.error) {
        setError(errMsg(r.error));
        setState("error");
      } else if (!r.data) setState("missing");
      else {
        setE(rowToEntry(r.data));
        setState("ok");
      }
    });
  }, []);

  const k = e ? KINDS[e.kind] ?? KINDS.agent : null;
  const site = safeUrl(e?.site);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/mapa" className="text-sm font-medium text-brand hover:underline">← Voltar ao mapa</Link>
        {state === "loading" && <p className="mt-6 text-slate-500">Carregando…</p>}
        {state === "missing" && <p className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-slate-600">Este cadastro não está mais publicado.</p>}
        {state === "error" && <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {state === "ok" && e && k && (
          <article className="mt-4 space-y-5">
            <header>
              <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: k.color }}>{k.label}</span>
              <h1 className="mt-2 text-3xl font-bold leading-tight">{e.name}</h1>
              {e.startsAt && <p className="mt-1 font-medium text-slate-700">{fmtDate(new Date(e.startsAt))}</p>}
              {(e.place || e.address || e.city) && (
                <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                  <Icon name="pin" className="h-4 w-4 shrink-0" />
                  {[e.place, e.address, e.city].filter(Boolean).join(", ")}
                </p>
              )}
            </header>

            <Media photos={photoUrls(e.photos)} videos={youtubeIds(e.videos)} />

            <p className="whitespace-pre-line text-slate-800">{e.longDescription || e.shortDescription}</p>

            {(e.type || e.areas?.length > 0) && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {e.type && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{e.type}</span>}
                {e.areas?.map((a) => <span key={a} className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-dark">{a}</span>)}
              </div>
            )}

            <div className="space-y-1 text-sm text-slate-700">
              {e.contact && <p><strong>Contato:</strong> {e.contact}</p>}
              {site && <p><a className="font-semibold text-brand underline" href={site} target="_blank" rel="noopener noreferrer">Site ou rede social ↗</a></p>}
              {e.lat != null && e.lng != null && (
                <p><a className="font-semibold text-brand underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=17/${e.lat}/${e.lng}`}>Ver no mapa ↗</a></p>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
