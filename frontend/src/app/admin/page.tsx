"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { APPWRITE, Query, databases, errMsg, publicData, type EntryStatus, type Submission } from "@/lib/appwrite";
import { KINDS, fmtDate } from "@/lib/mapas";
import { useUser } from "@/lib/useUser";
import { Permission, Role } from "appwrite";

const TABS: { key: EntryStatus; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Rejeitados" },
];

export default function AdminPage() {
  const { user, loading, isAdmin } = useUser();
  const [tab, setTab] = useState<EntryStatus>("pending");
  const [list, setList] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<EntryStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [r, p, a, j] = await Promise.all([
        databases.listDocuments(APPWRITE.database, APPWRITE.submissions, [Query.equal("status", tab), Query.orderDesc("$createdAt"), Query.limit(100)]),
        ...(["pending", "approved", "rejected"] as const).map((s) =>
          databases.listDocuments(APPWRITE.database, APPWRITE.submissions, [Query.equal("status", s), Query.limit(1)]),
        ),
      ]);
      setList(r.documents as unknown as Submission[]);
      setCounts({ pending: p.total, approved: a.total, rejected: j.total });
      setError("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    load();
  }, [load]);

  /** Aprovar = publicar (documento público com o MESMO id do envio) e marcar o envio como aprovado. */
  async function approve(s: Submission) {
    setWorking(s.$id);
    setError("");
    try {
      const data = publicData(s as never);
      try {
        await databases.updateDocument(APPWRITE.database, APPWRITE.published, s.$id, { ...data, submissionId: s.$id });
      } catch (e) {
        if ((e as { code?: number }).code !== 404) throw e;
        await databases.createDocument(APPWRITE.database, APPWRITE.published, s.$id, { ...data, submissionId: s.$id });
      }
      await databases.updateDocument(APPWRITE.database, APPWRITE.submissions, s.$id, { status: "approved", note: null });
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorking(null);
    }
  }

  async function unpublish(s: Submission, to: "pending" | "rejected", note: string | null) {
    setWorking(s.$id);
    setError("");
    try {
      try {
        await databases.deleteDocument(APPWRITE.database, APPWRITE.published, s.$id);
      } catch (e) {
        if ((e as { code?: number }).code !== 404) throw e; // já não estava publicado
      }
      await databases.updateDocument(APPWRITE.database, APPWRITE.submissions, s.$id, { status: to, note });
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorking(null);
    }
  }

  function reject(s: Submission) {
    const note = prompt("Motivo da rejeição (o agente vai ver):", s.note ?? "");
    if (note === null) return;
    unpublish(s, "rejected", note.trim() || "Sem motivo informado.");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        {loading && <p className="text-gray-500">Carregando…</p>}

        {!loading && !user && (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="mb-3">Entre com a conta de administrador.</p>
            <Link href="/entrar" className="rounded bg-brand px-5 py-2 font-medium text-white">Entrar</Link>
          </div>
        )}

        {!loading && user && !isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <p className="font-medium text-amber-900">Esta conta não é de administrador.</p>
            <p className="mt-1 text-sm text-amber-800">
              No Appwrite, abra Auth → seu usuário → Labels e adicione <code className="rounded bg-white px-1">admin</code>. Depois saia e entre de novo aqui.
            </p>
          </div>
        )}

        {isAdmin && (
          <>
            <h1 className="text-2xl font-bold">Aprovações</h1>
            <div className="flex gap-1 rounded-lg bg-brand-soft p-1" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brand text-white shadow-sm" : "text-brand-dark hover:bg-white/60"}`}>
                  {t.label} ({counts[t.key]})
                </button>
              ))}
            </div>

            {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {busy && <p className="text-gray-500">Carregando…</p>}
            {!busy && list.length === 0 && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Nada por aqui.</p>}

            <ul className="space-y-3">
              {list.map((s) => (
                <li key={s.$id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: KINDS[s.kind].color }}>{KINDS[s.kind].label}</div>
                  <h2 className="text-lg font-semibold leading-snug">{s.name}</h2>
                  <p className="text-xs text-gray-500">Enviado por {s.ownerName || "—"} em {new Date(s.$createdAt).toLocaleDateString("pt-BR")}</p>
                  <p className="mt-2 text-sm text-gray-700">{s.shortDescription}</p>
                  <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-sm text-gray-600 sm:grid-cols-2">
                    {s.type && <div><dt className="inline font-medium">Tipo: </dt><dd className="inline">{s.type}</dd></div>}
                    {s.areas?.length > 0 && <div><dt className="inline font-medium">Áreas: </dt><dd className="inline">{s.areas.join(", ")}</dd></div>}
                    {(s.address || s.city) && <div><dt className="inline font-medium">Endereço: </dt><dd className="inline">{[s.address, s.city].filter(Boolean).join(" — ")}</dd></div>}
                    {s.startsAt && <div><dt className="inline font-medium">Quando: </dt><dd className="inline">{fmtDate(new Date(s.startsAt))}</dd></div>}
                    {s.place && <div><dt className="inline font-medium">Local: </dt><dd className="inline">{s.place}</dd></div>}
                    {s.contact && <div><dt className="inline font-medium">Contato: </dt><dd className="inline">{s.contact}</dd></div>}
                    {s.site && <div className="min-w-0 truncate"><dt className="inline font-medium">Site: </dt><dd className="inline">{s.site}</dd></div>}
                    {s.lat != null && s.lng != null && (
                      <div><dt className="inline font-medium">Ponto: </dt>
                        <dd className="inline"><a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`}>ver no mapa ↗</a></dd></div>
                    )}
                  </dl>
                  {s.status === "rejected" && s.note && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700"><strong>Motivo:</strong> {s.note}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.status !== "approved" && (
                      <button disabled={working === s.$id} onClick={() => approve(s)} className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                        {working === s.$id ? "Publicando…" : "Aprovar e publicar"}
                      </button>
                    )}
                    {s.status === "approved" && (
                      <>
                        <button disabled={working === s.$id} onClick={() => approve(s)} className="rounded border px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" title="Atualiza o que está no mapa com o texto atual do cadastro">Republicar</button>
                        <button disabled={working === s.$id} onClick={() => unpublish(s, "pending", null)} className="rounded border px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Tirar do mapa</button>
                      </>
                    )}
                    {s.status !== "rejected" && (
                      <button disabled={working === s.$id} onClick={() => reject(s)} className="rounded border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Rejeitar</button>
                    )}
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
