"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import SiteHeader from "@/components/SiteHeader";
import { fetchLocal } from "@/lib/local";
import { KINDS, KIND_ORDER, SUBMIT_KINDS, fetchKind, fmtDate, itemHref, type Item, type Kind } from "@/lib/mapas";
import { POST_KINDS, POST_LIST_COLS, rowToPost, type Post } from "@/lib/posts";
import { supabase } from "@/lib/supabase";

/** Busca única: eventos, espaços, agentes, projetos, oportunidades, blog e podcast de uma vez. */
export default function BuscaPage() {
  const [q, setQ] = useState("");
  const [ceara, setCeara] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [failed, setFailed] = useState(0);

  async function run(term: string, withCeara: boolean) {
    const t = term.trim();
    if (t.length < 2) return;
    setState("loading");
    const jobs: Promise<Item[]>[] = [];
    for (const k of KIND_ORDER) {
      jobs.push(fetchKind("aquiraz", k, { q: t }).then((r) => r.items));
      if (withCeara) jobs.push(fetchKind("estado", k, { q: t }).then((r) => r.items));
    }
    for (const k of SUBMIT_KINDS) jobs.push(fetchLocal(k, { q: t }).then((r) => r.items));
    const [res, pr] = await Promise.all([
      Promise.allSettled(jobs),
      supabase.from("mc_posts").select(POST_LIST_COLS).eq("status", "published").or(`title.ilike.%${t.replace(/[%,()]/g, " ")}%,summary.ilike.%${t.replace(/[%,()]/g, " ")}%`).limit(12),
    ]);
    setFailed(res.filter((r) => r.status === "rejected").length);
    const all = res.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const seen = new Set<string>();
    setItems(all.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true))));
    setPosts((pr.data ?? []).map(rowToPost));
    setState("done");
  }

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("q") ?? "";
    setQ(t);
    if (t) run(t, false);
  }, []);

  const total = items.length + posts.length;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Buscar</h1>
        <form onSubmit={(e) => { e.preventDefault(); history.replaceState(null, "", `/busca?q=${encodeURIComponent(q)}`); run(q, ceara); }} className="mt-4 flex gap-2" role="search">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Evento, artista, espaço, texto…" aria-label="Buscar" className="!pl-11" autoFocus />
          </div>
          <button className="shrink-0 rounded-xl bg-sea px-6 font-semibold text-white hover:bg-sea-deep">Buscar</button>
        </form>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={ceara} onChange={(e) => setCeara(e.target.checked)} />
          Incluir também o Mapa Cultural do Ceará (mais lento)
        </label>

        {state === "loading" && <p className="mt-6 text-slate-500">Buscando…</p>}
        {state === "done" && (
          <div className="mt-6 space-y-8">
            <p className="text-sm text-slate-600">{total === 0 ? "Nada encontrado." : `${total} resultado(s).`}{failed > 0 && " Algumas fontes não responderam."}</p>

            {KIND_ORDER.map((k: Kind) => {
              const list = items.filter((i) => i.kind === k);
              if (!list.length) return null;
              return (
                <section key={k}>
                  <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: KINDS[k].color }}><Icon name={k} className="h-4 w-4" /></span>
                    {KINDS[k].plural} ({list.length})
                  </h2>
                  <ul className="space-y-2">
                    {list.slice(0, 20).map((it) => (
                      <li key={it.key}>
                        <Link href={itemHref(it)} className="block rounded-xl border border-slate-200 bg-white p-3 hover:shadow-lift">
                          <span className="font-semibold">{it.name}</span>
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{it.source === "local" ? "Site" : it.source === "aquiraz" ? "Aquiraz" : "Ceará"}</span>
                          {(it.startsAt || it.place || it.city) && <span className="mt-0.5 block text-sm text-slate-600">{[it.startsAt ? fmtDate(it.startsAt) : null, it.place, it.city].filter(Boolean).join(" · ")}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {posts.length > 0 && (
              <section>
                <h2 className="mb-2 font-display text-xl font-semibold">Blog e podcast ({posts.length})</h2>
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/leitura/${p.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 hover:shadow-lift">
                        <span className="text-xs font-semibold" style={{ color: POST_KINDS[p.kind].color }}>{POST_KINDS[p.kind].label}</span>
                        <span className="block font-semibold">{p.title}</span>
                        {p.summary && <span className="line-clamp-2 text-sm text-slate-600">{p.summary}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
