"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import RoleBadge from "@/components/RoleBadge";
import SiteHeader from "@/components/SiteHeader";
import { T, errMsg, publicData, rowToSubmission, supabase, type EntryStatus, type Submission } from "@/lib/supabase";
import { KINDS, SOURCES, fmtDate } from "@/lib/mapas";
import Numeros from "@/components/Numeros";
import { baixarCsv } from "@/lib/csv";
import { useUser } from "@/lib/useUser";
import AdminPosts from "@/components/AdminPosts";
import CampoAdmin from "@/components/CampoAdmin";
import Equipe from "@/components/Equipe";
import Media from "@/components/Media";
import { photoUrls } from "@/lib/media";

const TABS: { key: EntryStatus; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Rejeitados" },
];

export default function AdminPage() {
  const { user, loading, isAdmin, isStaff, papel } = useUser();
  const [tab, setTab] = useState<EntryStatus>("pending");
  const [list, setList] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<EntryStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"aprovacoes" | "textos" | "campo" | "numeros" | "equipe">("aprovacoes");

  const load = useCallback(async () => {
    if (!isStaff) return;
    setBusy(true);
    try {
      const count = (st: EntryStatus) => supabase.from(T.cadastros).select("id", { count: "exact", head: true }).eq("status", st);
      const [r, p, a, j] = await Promise.all([
        supabase.from(T.cadastros).select("*").eq("status", tab).order("created_at", { ascending: false }).limit(100),
        count("pending"),
        count("approved"),
        count("rejected"),
      ]);
      if (r.error) throw r.error;
      setList((r.data ?? []).map(rowToSubmission));
      setCounts({ pending: p.count ?? 0, approved: a.count ?? 0, rejected: j.count ?? 0 });
      setError("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [isStaff, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const quem = () => ({ reviewed_by: user!.id, reviewed_by_name: user!.name || user!.email.split("@")[0], reviewed_at: new Date().toISOString() });

  /** Aprovar = publicar (documento público com o MESMO id do envio) e marcar o envio como aprovado. */
  async function approve(s: Submission) {
    setWorking(s.id);
    setError("");
    try {
      const pub = await supabase.from(T.publicados).upsert({ id: s.id, kind: s.kind, data: publicData(s as never) });
      if (pub.error) throw pub.error;
      const up = await supabase.from(T.cadastros).update({ status: "approved", note: null, ...quem() }).eq("id", s.id);
      if (up.error) throw up.error;
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorking(null);
    }
  }

  async function unpublish(s: Submission, to: "pending" | "rejected", note: string | null) {
    setWorking(s.id);
    setError("");
    try {
      const del = await supabase.from(T.publicados).delete().eq("id", s.id);
      if (del.error) throw del.error;
      const up = await supabase.from(T.cadastros).update({ status: to, note, ...quem() }).eq("id", s.id);
      if (up.error) throw up.error;
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorking(null);
    }
  }

  async function exportar() {
    const r = await supabase.from(T.cadastros).select("*").order("created_at", { ascending: false }).limit(5000);
    if (r.error) return setError(errMsg(r.error));
    const L = (r.data ?? []).map(rowToSubmission);
    baixarCsv(`cadastros-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Situação", "Tipo", "Nome", "Resumo", "Descrição", "Subtipo", "Áreas", "Endereço", "Cidade", "Local", "Início", "Fim", "Latitude", "Longitude", "Site", "Contato", "Enviado por", "Enviado em", "Decidido por", "Decidido em", "Motivo"],
      ...L.map((s) => [
        s.status === "approved" ? "Aprovado" : s.status === "rejected" ? "Rejeitado" : "Pendente", KINDS[s.kind]?.label ?? s.kind, s.name, s.shortDescription, s.longDescription, s.type,
        (s.areas ?? []).join(", "), s.address, s.city, s.place, s.startsAt, s.endsAt, s.lat, s.lng, s.site, s.contact, s.ownerName,
        new Date(s.createdAt).toLocaleString("pt-BR"), s.reviewedByName, s.reviewedAt ? new Date(s.reviewedAt).toLocaleString("pt-BR") : "", s.note,
      ]),
    ]);
  }

  /** O envio automático para o mapa oficial depende de chaves de acesso deles; enquanto isso, a ficha pronta para colar. */
  async function copiarFicha(s: Submission) {
    const linhas = [
      `${KINDS[s.kind].label}: ${s.name}`,
      s.type && `Tipo: ${s.type}`,
      s.areas?.length ? `Áreas: ${s.areas.join(", ")}` : null,
      `Descrição curta: ${s.shortDescription}`,
      s.longDescription && `Descrição completa:\n${s.longDescription}`,
      s.place && `Local: ${s.place}`,
      s.startsAt && `Início: ${fmtDate(new Date(s.startsAt))}`,
      s.endsAt && `Fim: ${fmtDate(new Date(s.endsAt))}`,
      (s.address || s.city) && `Endereço: ${[s.address, s.city].filter(Boolean).join(", ")}`,
      s.lat != null && s.lng != null && `Coordenadas: ${s.lat}, ${s.lng}`,
      s.contact && `Contato: ${s.contact}`,
      s.site && `Site: ${s.site}`,
      s.videos?.length ? `Vídeos: ${s.videos.map((v) => `https://youtu.be/${v}`).join(" ")}` : null,
      s.photos?.length ? `Fotos:\n${s.photos.join("\n")}` : null,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setError("");
      alert(`Ficha copiada. Abra o painel do mapa oficial para colar:\nAquiraz: ${SOURCES.aquiraz.site}/painel/\nCeará: ${SOURCES.estado.site}/painel/`);
    } catch {
      prompt("Copie a ficha:", linhas.join("\n"));
    }
  }

  function reject(s: Submission) {
    const note = prompt("Motivo da rejeição (o agente vai ver):", s.note ?? "");
    if (note === null) return;
    unpublish(s, "rejected", note.trim() || "Sem motivo informado.");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        {loading && <p className="text-gray-500">Carregando…</p>}

        {!loading && !user && (
          <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center shadow-lift">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand"><Icon name="shield" className="h-6 w-6" /></span>
            <h1 className="text-xl font-bold">Área da equipe</h1>
            <p className="mt-2 text-sm text-slate-600">Entre com a conta de administrador para aprovar os cadastros dos agentes.</p>
            <Link href="/entrar" className="mt-5 inline-block rounded-full bg-sea px-6 py-2.5 font-semibold text-white hover:bg-sea-deep">Entrar</Link>
          </div>
        )}

        {!loading && user && !isStaff && (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="font-display text-lg font-semibold text-amber-900">Esta conta não tem acesso de administração</h1>
            <p className="mt-2 text-sm text-amber-900/80">
              Você entrou como {user.email}. Para aprovar cadastros, entre com a conta de administrador do site.
            </p>
            <p className="mt-2 text-sm text-amber-900/80">
              Quem já é administrador pode dar o acesso em Administração, aba Equipe. Depois é só sair e entrar de novo.
            </p>
          </div>
        )}

        {isStaff && (
          <>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Administração</h1><RoleBadge papel={papel} /></div>
            <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4" role="tablist" aria-label="Seções">
              {([["aprovacoes", "Cadastros"], ["textos", "Blog e podcast"], ["campo", "Formulários de campo"], ["numeros", "Números"], ["equipe", "Equipe"]] as const).filter(([k]) => isAdmin || k === "aprovacoes" || k === "textos" || k === "numeros").map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                  className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${view === k ? "border-sea text-sea" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  {l}
                </button>
              ))}
            </div>

            {view === "equipe" && <Equipe meId={user!.id} />}
            {view === "textos" && <AdminPosts reviewer={{ id: user!.id, name: user!.name || user!.email.split("@")[0] }} />}
            {view === "numeros" && <Numeros isAdmin={isAdmin} />}
            {view === "campo" && <CampoAdmin userId={user!.id} />}

            {view === "aprovacoes" && (<>
            <div className="flex justify-end"><button onClick={exportar} className="rounded-full border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Exportar tudo (planilha .csv)</button></div>
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
                <li key={s.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold" style={{ color: KINDS[s.kind].color }}>{KINDS[s.kind].label}</div>
                  <h2 className="text-lg font-semibold leading-snug">{s.name}</h2>
                  {s.status !== "pending" && s.reviewedByName && <p className="text-xs text-slate-500">{s.status === "approved" ? "Aprovado" : "Rejeitado"} por {s.reviewedByName}{s.reviewedAt ? ` em ${new Date(s.reviewedAt).toLocaleDateString("pt-BR")}` : ""}</p>}
                  <p className="text-xs text-gray-500">Enviado por {s.ownerName || "—"} em {new Date(s.createdAt).toLocaleDateString("pt-BR")}</p>
                  <p className="mt-2 text-sm text-gray-700">{s.shortDescription}</p>
                  <div className="mt-3 max-w-md"><Media photos={photoUrls(s.photos)} videos={s.videos} /></div>
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
                      <button disabled={working === s.id} onClick={() => approve(s)} className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                        {working === s.id ? "Publicando…" : "Aprovar e publicar"}
                      </button>
                    )}
                    {s.status === "approved" && (
                      <>
                        <button disabled={working === s.id} onClick={() => approve(s)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" title="Atualiza o que está no mapa com o texto atual do cadastro">Republicar</button>
                        <button onClick={() => copiarFicha(s)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50" title="Copia os dados para você colar ao cadastrar no mapa oficial">Ficha para o mapa oficial</button>
                        <button disabled={working === s.id} onClick={() => unpublish(s, "pending", null)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Tirar do mapa</button>
                      </>
                    )}
                    {s.status !== "rejected" && (
                      <button disabled={working === s.id} onClick={() => reject(s)} className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Rejeitar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            </>)}
          </>
        )}
      </main>
    </div>
  );
}
