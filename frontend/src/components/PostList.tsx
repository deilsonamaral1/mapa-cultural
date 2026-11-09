"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { POST_KINDS, POST_LIST_COLS, fmtPostDate, rowToPost, type Post, type PostKind } from "@/lib/posts";
import { errMsg, supabase } from "@/lib/supabase";

/** Lista pública de publicações aprovadas (blog ou podcast). `limit` serve para a tela inicial. */
export default function PostList({ kind, limit, compact = false, home = false }: { kind?: PostKind; limit?: number; compact?: boolean; home?: boolean }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let q = supabase.from("mc_posts").select(POST_LIST_COLS).eq("status", "published").order("published_at", { ascending: false }).limit(limit ?? 60);
    if (kind) q = q.eq("kind", kind);
    q.then((r) => {
      if (r.error) setError(errMsg(r.error));
      else setPosts((r.data ?? []).map(rowToPost));
    });
  }, [kind, limit]);

  if (home && (error || !posts || posts.length === 0)) return null; // na tela inicial, some se não há nada
  if (error) return compact ? null : <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!posts) return <p className="text-slate-500">Carregando…</p>;
  if (posts.length === 0)
    return compact ? null : (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
        Ainda não há publicações por aqui. Em breve!
      </p>
    );

  const grid = (
    <ul className={`grid gap-4 ${compact ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
      {posts.map((p) => {
        const k = POST_KINDS[p.kind];
        return (
          <li key={p.id}>
            <a href={`/leitura/${p.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lift">
              {p.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover} alt="" loading="lazy" className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-24 place-items-center text-white" style={{ background: k.color }}>
                  <Icon name={p.kind === "podcast" ? "mic" : "blog"} className="h-9 w-9" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <span className="text-xs font-semibold" style={{ color: k.color }}>{k.label}</span>
                <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug group-hover:text-brand">{p.title}</h3>
                {p.summary && <p className="mt-1.5 line-clamp-3 text-sm text-slate-600">{p.summary}</p>}
                <p className="mt-auto pt-3 text-xs text-slate-500">{[p.authorName, fmtPostDate(p.publishedAt)].filter(Boolean).join(" · ")}</p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (!home) return grid;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-bold">Blog e podcast</h2>
        <span className="flex shrink-0 gap-4 text-sm font-semibold">
          <a href="/blog" className="text-brand underline-offset-4 hover:underline">Blog</a>
          <a href="/podcast" className="text-brand underline-offset-4 hover:underline">Podcast</a>
        </span>
      </div>
      {grid}
    </section>
  );
}
