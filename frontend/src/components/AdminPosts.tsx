"use client";

import { useCallback, useEffect, useState } from "react";
import PostPlayer from "@/components/PostPlayer";
import { POST_STAFF_COLS, POST_KINDS, rowToPost, type Post, type PostStatus } from "@/lib/posts";
import { errMsg, supabase } from "@/lib/supabase";

const TABS: { key: PostStatus; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "published", label: "Publicados" },
  { key: "rejected", label: "Rejeitados" },
];

/** Aprovação de textos e episódios enviados pelos agentes. */
export default function AdminPosts({ reviewer }: { reviewer: { id: string; name: string } }) {
  const [tab, setTab] = useState<PostStatus>("pending");
  const [list, setList] = useState<Post[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.from("mc_posts").select(POST_STAFF_COLS).eq("status", tab).order("created_at", { ascending: false }).limit(100);
    if (r.error) setError(errMsg(r.error));
    else {
      setList((r.data ?? []).map(rowToPost));
      setError("");
    }
    setBusy(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(p: Post, status: PostStatus, note: string | null = null) {
    setWorking(p.id);
    setError("");
    const patch: Record<string, unknown> = { status, note, reviewed_by: reviewer.id, reviewed_by_name: reviewer.name, reviewed_at: new Date().toISOString() };
    if (status === "published") patch.published_at = new Date().toISOString();
    const r = await supabase.from("mc_posts").update(patch).eq("id", p.id);
    if (r.error) setError(errMsg(r.error));
    else await load();
    setWorking(null);
  }

  function reject(p: Post) {
    const note = prompt("Motivo da rejeição (o autor vai ver):", p.note ?? "");
    if (note !== null) setStatus(p, "rejected", note.trim() || "Sem motivo informado.");
  }

  return (
    <section className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-brand-soft p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brand text-white shadow-sm" : "text-brand-dark hover:bg-white/60"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}
      {!busy && list.length === 0 && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Nada por aqui.</p>}

      <ul className="space-y-3">
        {list.map((p) => (
          <li key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold" style={{ color: POST_KINDS[p.kind].color }}>{POST_KINDS[p.kind].label}</div>
            <h2 className="text-lg font-semibold leading-snug">{p.title}</h2>
            <p className="text-xs text-gray-500">Por {p.authorName || "—"} em {new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
            {p.summary && <p className="mt-2 text-sm text-gray-700">{p.summary}</p>}
            {p.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cover} alt="" className="mt-2 h-28 rounded-lg object-cover" />
            )}
            <div className="mt-2 max-w-md"><PostPlayer audio={p.audio} embed={p.embed} /></div>
            {p.body && <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium text-brand">Ler o texto</summary><div className="mt-2 whitespace-pre-line text-gray-700">{p.body}</div></details>}
            {p.status !== "pending" && p.reviewedByName && <p className="mt-1 text-xs text-slate-500">{p.status === "published" ? "Aprovado" : "Rejeitado"} por {p.reviewedByName}{p.reviewedAt ? ` em ${new Date(p.reviewedAt).toLocaleDateString("pt-BR")}` : ""}</p>}
            {p.status === "rejected" && p.note && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700"><strong>Motivo:</strong> {p.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status !== "published" && <button disabled={working === p.id} onClick={() => setStatus(p, "published")} className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Aprovar e publicar</button>}
              {p.status === "published" && <>
                <a href={`/leitura/${p.id}`} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Ver no site</a>
                <button disabled={working === p.id} onClick={() => setStatus(p, "pending")} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Tirar do ar</button>
              </>}
              {p.status !== "rejected" && <button disabled={working === p.id} onClick={() => reject(p)} className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Rejeitar</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
