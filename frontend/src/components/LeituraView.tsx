"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PostPlayer from "@/components/PostPlayer";
import ShareBar from "@/components/ShareBar";
import SiteHeader from "@/components/SiteHeader";
import { POST_ALL_COLS, POST_KINDS, fmtPostDate, rowToPost, type Post } from "@/lib/posts";
import { errMsg, supabase } from "@/lib/supabase";

/** Um texto do blog ou episódio de podcast publicado. */
export default function LeituraView({ id }: { id: string }) {
  const [p, setP] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("mc_posts").select(POST_ALL_COLS).eq("id", id).maybeSingle().then((r) => {
      if (r.error) {
        setError(errMsg(r.error));
        setState("error");
      } else if (!r.data) setState("missing");
      else {
        setP(rowToPost(r.data));
        setState("ok");
      }
    });
  }, [id]);

  const k = p ? POST_KINDS[p.kind] : null;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href={p ? k!.path : "/blog"} className="text-sm font-medium text-brand hover:underline">← Voltar{p ? ` para ${k!.plural}` : ""}</Link>
        {state === "loading" && <p className="mt-6 text-slate-500">Carregando…</p>}
        {state === "missing" && <p className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-slate-600">Esta publicação não está disponível.</p>}
        {state === "error" && <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {state === "ok" && p && k && (
          <article className="mt-4 space-y-5">
            {p.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cover} alt="" className="max-h-80 w-full rounded-2xl object-cover" />
            )}
            <header>
              <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: k.color }}>{k.label}</span>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{p.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{[p.authorName && `Por ${p.authorName}`, fmtPostDate(p.publishedAt)].filter(Boolean).join(" · ")}</p>
            </header>
            <ShareBar title={p.title} kind={p.kind} />
            {p.summary && <p className="text-lg leading-relaxed text-slate-700">{p.summary}</p>}
            <PostPlayer audio={p.audio} embed={p.embed} />
            {p.body && <div className="whitespace-pre-line text-[17px] leading-relaxed text-slate-800">{p.body}</div>}
          </article>
        )}
      </main>
    </div>
  );
}
