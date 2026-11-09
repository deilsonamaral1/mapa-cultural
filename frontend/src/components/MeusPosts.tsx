"use client";

import { useCallback, useEffect, useState } from "react";
import PostForm from "@/components/PostForm";
import { POST_STAFF_COLS, POST_KINDS, rowToPost, type Post, type PostStatus } from "@/lib/posts";
import { errMsg, supabase } from "@/lib/supabase";

const STATUS: Record<PostStatus, { label: string; cls: string }> = {
  pending: { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-800" },
  published: { label: "Publicado", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Não aprovado", cls: "bg-red-100 text-red-700" },
};

/** Seção do painel: textos do blog e episódios de podcast do próprio usuário. */
export default function MeusPosts({ userId, userName, isAdmin }: { userId: string; userName: string; isAdmin: boolean }) {
  const [list, setList] = useState<Post[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Post | "new" | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.from("mc_posts").select(POST_STAFF_COLS).eq("author_id", userId).order("created_at", { ascending: false }).limit(100);
    if (r.error) setError(`Ao carregar suas publicações: ${errMsg(r.error)}`);
    else {
      setList((r.data ?? []).map(rowToPost));
      setError("");
    }
    setBusy(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(p: Post) {
    if (!confirm(`Apagar "${p.title}"?`)) return;
    const r = await supabase.from("mc_posts").delete().eq("id", p.id);
    if (r.error) setError(errMsg(r.error));
    else load();
  }

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Blog e podcast</h2>
          <p className="text-sm text-slate-600">Publique textos e episódios de áudio. {isAdmin ? "Os seus saem direto no ar." : "A equipe revisa antes de publicar."}</p>
        </div>
        {!editing && <button onClick={() => setEditing("new")} className="rounded-full bg-sea px-5 py-2.5 font-semibold text-white hover:bg-sea-deep">+ Nova publicação</button>}
      </div>

      {editing && (
        <PostForm userId={userId} userName={userName} isAdmin={isAdmin} initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}
      {!busy && !error && list.length === 0 && !editing && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Você ainda não publicou nada no blog ou no podcast.</p>}

      <ul className="space-y-3">
        {list.map((p) => (
          <li key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold" style={{ color: POST_KINDS[p.kind].color }}>{POST_KINDS[p.kind].label}</div>
                <h3 className="font-semibold leading-snug">{p.title}</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
            </div>
            {p.status !== "pending" && p.reviewedByName && <p className="mt-1 text-xs text-slate-500">{p.status === "published" ? "Aprovado" : "Não aprovado"} por {p.reviewedByName}{p.reviewedAt ? ` em ${new Date(p.reviewedAt).toLocaleDateString("pt-BR")}` : ""}</p>}
            {p.status === "rejected" && p.note && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700"><strong>Motivo:</strong> {p.note}</p>}
            <div className="mt-3 flex gap-3 text-sm">
              {(isAdmin || p.status !== "published") && <button onClick={() => setEditing(p)} className="font-medium text-brand-dark hover:underline">Editar</button>}
              {p.status === "published" && <a href={`/leitura/${p.id}`} className="font-medium text-brand-dark hover:underline">Ver no site</a>}
              <button onClick={() => remove(p)} className="text-gray-500 hover:underline">Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
