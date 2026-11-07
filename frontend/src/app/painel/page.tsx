"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import EntryForm from "@/components/EntryForm";
import RoleBadge from "@/components/RoleBadge";
import SiteHeader from "@/components/SiteHeader";
import { APPWRITE, Query, databases, errMsg, rowToSubmission, type EntryStatus, type Submission } from "@/lib/appwrite";
import { KINDS } from "@/lib/mapas";
import { useUser } from "@/lib/useUser";

const STATUS: Record<EntryStatus, { label: string; cls: string }> = {
  pending: { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Aprovado", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Não aprovado", cls: "bg-red-100 text-red-700" },
};

export default function PainelPage() {
  const { user, loading, isAdmin } = useUser();
  const [list, setList] = useState<Submission[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Submission | "new" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const r = await databases.listDocuments(APPWRITE.database, APPWRITE.submissions, [
        Query.equal("ownerId", user.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
      setList(r.documents.map(rowToSubmission));
      setError("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(s: Submission) {
    if (!confirm(`Apagar "${s.name}"? Se já estiver publicado, a administração precisa despublicar.`)) return;
    try {
      await databases.deleteDocument(APPWRITE.database, APPWRITE.submissions, s.$id);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {loading && <p className="text-gray-500">Carregando…</p>}

        {!loading && !user && (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="mb-3">Entre na sua conta para ver e criar cadastros.</p>
            <Link href="/entrar" className="rounded bg-brand px-5 py-2 font-medium text-white">Entrar</Link>
          </div>
        )}

        {user && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">Meu painel</h1>
                  <RoleBadge admin={isAdmin} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Olá, {user.name || user.email}.{" "}
                  {isAdmin
                    ? "Você é administrador: aprova os cadastros da equipe e também pode enviar os seus."
                    : "Você é agente: tudo que enviar é revisado pela equipe antes de aparecer no mapa."}
                </p>
                {isAdmin && (
                  <Link href="/admin" className="mt-2 inline-flex rounded-full bg-sun/15 px-4 py-2 text-sm font-semibold text-sun-dark hover:bg-sun/25">
                    Ir para a Administração
                  </Link>
                )}
              </div>
              {!editing && (
                <button onClick={() => setEditing("new")} className="rounded bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark">+ Novo cadastro</button>
              )}
            </div>

            {editing && (
              <EntryForm
                ownerId={user.$id}
                ownerName={user.name || user.email}
                initial={editing === "new" ? undefined : editing}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); load(); }}
              />
            )}

            {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {busy && <p className="text-gray-500">Carregando seus cadastros…</p>}
            {!busy && !error && list.length === 0 && !editing && (
              <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Você ainda não enviou nenhum cadastro. Clique em “Novo cadastro”.</p>
            )}

            <ul className="space-y-3">
              {list.map((s) => (
                <li key={s.$id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold" style={{ color: KINDS[s.kind].color }}>{KINDS[s.kind].label}</div>
                      <h2 className="font-semibold leading-snug">{s.name}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{s.shortDescription}</p>
                  {s.status === "rejected" && s.note && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700"><strong>Motivo:</strong> {s.note}</p>}
                  <div className="mt-3 flex gap-3 text-sm">
                    <button onClick={() => setEditing(s)} className="font-medium text-brand-dark hover:underline">Editar</button>
                    <button onClick={() => remove(s)} className="text-gray-500 hover:underline">Apagar</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
