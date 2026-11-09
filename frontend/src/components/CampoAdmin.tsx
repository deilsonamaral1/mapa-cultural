"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MODELOS, TIPOS, campoLink, cleanPerguntas, normResp, signedUrls,
  type Anexo, type Formulario, type Pergunta, type PerguntaTipo, type Resposta,
} from "@/lib/campo";
import { baixarCsv } from "@/lib/csv";
import EntryForm from "@/components/EntryForm";
import { uploadPhoto } from "@/lib/media";
import { errMsg, supabase, type EntryData } from "@/lib/supabase";
import { youtubeId } from "@/lib/youtube";

type Linha = Formulario & { total: number };

const novaPergunta = (): Pergunta => ({ id: crypto.randomUUID().slice(0, 8), texto: "", tipo: "longo", obrigatoria: false });

/** Administração dos formulários de campo: criar, mandar o link, ver respostas com fotos, áudios e vídeos. */
export default function CampoAdmin({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Linha[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<{ t: "list" } | { t: "build"; initial?: Formulario; editId?: string } | { t: "resp"; form: Linha }>({ t: "list" });

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.from("mc_formularios").select("*").order("created_at", { ascending: false });
    if (r.error) {
      setError(errMsg(r.error));
      setBusy(false);
      return;
    }
    const list = await Promise.all(
      (r.data ?? []).map(async (f: any) => {
        const c = await supabase.from("mc_respostas").select("id", { count: "exact", head: true }).eq("form_id", f.id);
        return { id: f.id, titulo: f.titulo, descricao: f.descricao, perguntas: cleanPerguntas(f.perguntas), aberto: f.aberto, created_at: f.created_at, total: c.count ?? 0 } as Linha;
      }),
    );
    setRows(list);
    setError("");
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(f: Linha) {
    const link = campoLink(f.id);
    try {
      await navigator.clipboard.writeText(link);
      setMsg("Link copiado. Cole no WhatsApp ou e-mail do agente.");
    } catch {
      prompt("Copie o link:", link);
    }
  }

  async function toggle(f: Linha) {
    const r = await supabase.from("mc_formularios").update({ aberto: !f.aberto }).eq("id", f.id);
    if (r.error) setError(errMsg(r.error));
    else load();
  }

  async function remove(f: Linha) {
    if (!confirm(`Apagar "${f.titulo}" e as ${f.total} resposta(s)? Os arquivos enviados ficam guardados no Supabase.`)) return;
    const r = await supabase.from("mc_formularios").delete().eq("id", f.id);
    if (r.error) setError(errMsg(r.error));
    else load();
  }

  if (view.t === "build")
    return <Builder userId={userId} initial={view.initial} editId={view.editId} onDone={() => { setView({ t: "list" }); load(); }} />;
  if (view.t === "resp") return <Respostas form={view.form} userId={userId} onBack={() => { setView({ t: "list" }); load(); }} />;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-md text-sm text-slate-600">Crie perguntas, mande o link para o agente em campo e receba as respostas aqui, com fotos, áudios e vídeos.</p>
        <button onClick={() => setView({ t: "build" })} className="rounded-full bg-sea px-5 py-2.5 font-semibold text-white hover:bg-sea-deep">+ Novo formulário</button>
      </div>
      {msg && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}
      {!busy && !error && rows.length === 0 && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Nenhum formulário ainda.</p>}

      <ul className="space-y-3">
        {rows.map((f) => (
          <li key={f.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold leading-snug">{f.titulo}</h2>
                <p className="text-sm text-slate-500">{f.perguntas.length} pergunta(s) · {f.total} resposta(s)</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${f.aberto ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>{f.aberto ? "Aberto" : "Encerrado"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button onClick={() => copy(f)} className="rounded-full bg-sea px-4 py-2 font-semibold text-white">Copiar link</button>
              <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${f.titulo}\n${campoLink(f.id)}`)}`} className="rounded-full border border-green-600 px-4 py-2 font-semibold text-green-700">WhatsApp</a>
              <button onClick={() => setView({ t: "resp", form: f })} className="rounded-full border px-4 py-2 font-semibold">Ver respostas ({f.total})</button>
              <button onClick={() => toggle(f)} className="rounded-full border px-4 py-2">{f.aberto ? "Encerrar" : "Reabrir"}</button>
              {f.total === 0 && <button onClick={() => setView({ t: "build", initial: f, editId: f.id })} className="rounded-full border px-4 py-2">Editar</button>}
              <button onClick={() => setView({ t: "build", initial: { ...f, titulo: `${f.titulo} (cópia)` } })} className="rounded-full border px-4 py-2">Duplicar</button>
              <button onClick={() => remove(f)} className="rounded-full border border-red-300 px-4 py-2 text-red-700">Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Builder({ userId, initial, editId, onDone }: { userId: string; initial?: Formulario; editId?: string; onDone: () => void }) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [qs, setQs] = useState<Pergunta[]>(initial?.perguntas?.length ? initial.perguntas.map((q) => ({ ...q })) : [novaPergunta()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upd = (i: number, patch: Partial<Pergunta>) => setQs((c) => c.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) => setQs((c) => {
    const j = i + d;
    if (j < 0 || j >= c.length) return c;
    const n = [...c];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const perguntas = qs
      .filter((q) => q.texto.trim())
      .map((q, i, all) => ({
        id: q.id,
        texto: q.texto.trim(),
        tipo: q.tipo,
        obrigatoria: !!q.obrigatoria,
        ...(q.tipo === "escolha" ? { opcoes: (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
        // a condição só vale se apontar para uma pergunta ANTERIOR que ainda existe
        ...(q.condicao && q.condicao.igual && all.slice(0, i).some((a) => a.id === q.condicao!.id) ? { condicao: q.condicao } : {}),
      }));
    if (!perguntas.length) return setError("Escreva pelo menos uma pergunta.");
    if (perguntas.some((q) => q.tipo === "escolha" && (q.opcoes?.length ?? 0) < 2)) return setError("Perguntas de escolha precisam de pelo menos 2 opções.");
    setBusy(true);
    const row = { titulo: titulo.trim(), descricao: descricao.trim() || null, perguntas };
    const r = editId ? await supabase.from("mc_formularios").update(row).eq("id", editId) : await supabase.from("mc_formularios").insert({ ...row, criado_por: userId });
    setBusy(false);
    if (r.error) return setError(errMsg(r.error));
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <button type="button" onClick={onDone} className="text-sm font-medium text-brand hover:underline">← Voltar</button>
      <h2 className="font-display text-xl font-bold">{editId ? "Editar formulário" : "Novo formulário"}</h2>
      {!editId && !initial && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Começar de um modelo pronto (você pode mudar tudo depois):</p>
          <div className="flex flex-wrap gap-2">
            {MODELOS.map((m) => (
              <button key={m.nome} type="button" onClick={() => { setTitulo(m.titulo); setDescricao(m.descricao); setQs(m.perguntas()); }} className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-slate-50">{m.nome}</button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div><label>Título<input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Visita ao mestre de cultura popular" /></label></div>
        <div><label>Instruções para o agente (opcional)<textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label></div>
      </div>

      {qs.map((q, i) => (
        <div key={q.id} className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Pergunta {i + 1}</span>
            <span className="flex gap-1">
              <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center rounded-lg border">↑</button>
              <button type="button" aria-label="Descer" onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center rounded-lg border">↓</button>
              <button type="button" aria-label="Remover pergunta" onClick={() => setQs((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c))} className="grid h-9 w-9 place-items-center rounded-lg border text-red-600">×</button>
            </span>
          </div>
          <input value={q.texto} onChange={(e) => upd(i, { texto: e.target.value })} placeholder="Escreva a pergunta" aria-label={`Pergunta ${i + 1}`} />
          <select value={q.tipo} onChange={(e) => upd(i, { tipo: e.target.value as PerguntaTipo })} aria-label="Tipo de resposta">
            {(Object.keys(TIPOS) as PerguntaTipo[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
          {q.tipo === "escolha" && (
            <textarea rows={3} value={(q.opcoes ?? []).join("\n")} onChange={(e) => upd(i, { opcoes: e.target.value.split("\n") })} placeholder={"Uma opção por linha\nSim\nNão"} aria-label="Opções" />
          )}
          {(() => {
            const anteriores = qs.slice(0, i).filter((a) => (a.tipo === "escolha" || a.tipo === "escala") && a.texto.trim());
            if (!anteriores.length) return null;
            const alvo = anteriores.find((a) => a.id === q.condicao?.id);
            const valores = alvo ? (alvo.tipo === "escala" ? ["1", "2", "3", "4", "5"] : (alvo.opcoes ?? []).map((o) => o.trim()).filter(Boolean)) : [];
            return (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <label className="text-slate-600">Mostrar esta pergunta
                  <select value={q.condicao?.id ?? ""} onChange={(e) => upd(i, { condicao: e.target.value ? { id: e.target.value, igual: "" } : undefined })}>
                    <option value="">sempre</option>
                    {anteriores.map((a) => <option key={a.id} value={a.id}>só se a resposta de “{a.texto.trim().slice(0, 40)}” for…</option>)}
                  </select>
                </label>
                {alvo && (
                  <select className="mt-2" value={q.condicao?.igual ?? ""} onChange={(e) => upd(i, { condicao: { id: alvo.id, igual: e.target.value } })} aria-label="Valor que mostra a pergunta">
                    <option value="">escolha o valor</option>
                    {valores.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </div>
            );
          })()}
          <p className="text-xs text-slate-500">Em qualquer tipo, o agente também pode juntar fotos, áudios, vídeos e links.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!q.obrigatoria} onChange={(e) => upd(i, { obrigatoria: e.target.checked })} className="!h-5 !w-5" />Resposta obrigatória</label>
        </div>
      ))}

      <button type="button" onClick={() => setQs((c) => [...c, novaPergunta()])} className="w-full rounded-xl border-2 border-dashed border-slate-400 py-3 font-semibold text-slate-700">+ Adicionar pergunta</button>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-sea px-6 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">{busy ? "Salvando…" : "Salvar formulário"}</button>
    </form>
  );
}

function Respostas({ form, userId, onBack }: { form: Linha; userId: string; onBack: () => void }) {
  const [list, setList] = useState<Resposta[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [criando, setCriando] = useState<{ prefill: Partial<EntryData> } | null>(null);
  const [preparando, setPreparando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  /** Junta as respostas num rascunho de cadastro: texto, links do YouTube e até 4 fotos (copiadas para o espaço público). */
  async function prepararCadastro(x: Resposta) {
    setPreparando(x.id);
    setError("");
    try {
      const partes: string[] = [];
      const fotos: string[] = [];
      const videos: string[] = [];
      for (const q of form.perguntas) {
        const v = normResp(x.respostas?.[q.id]);
        if (v.texto) partes.push(`${q.texto}\n${v.texto}`);
        for (const a of v.anexos ?? []) {
          if (a.type === "link") {
            const yt = youtubeId(a.path);
            if (yt && !videos.includes(yt)) videos.push(yt);
          } else if (a.type.startsWith("image/") && fotos.length < 4 && urls[a.path]) {
            const blob = await (await fetch(urls[a.path])).blob();
            fotos.push(await uploadPhoto(userId, new File([blob], a.name, { type: a.type })));
          }
        }
      }
      const primeira = partes[0]?.split("\n").slice(1).join(" ") ?? "";
      setCriando({
        prefill: {
          shortDescription: primeira.slice(0, 280),
          longDescription: partes.join("\n\n") || null,
          contact: x.contato,
          photos: fotos,
          videos,
        },
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPreparando(null);
    }
  }

  const load = useCallback(async () => {
    const r = await supabase.from("mc_respostas").select("*").eq("form_id", form.id).order("created_at", { ascending: false });
    if (r.error) {
      setError(errMsg(r.error));
      setBusy(false);
      return;
    }
    const data = (r.data ?? []) as Resposta[];
    setList(data);
    const paths = data.flatMap((x) => Object.values(x.respostas ?? {}).flatMap((v) => (normResp(v).anexos ?? []).filter((a) => a.type !== "link").map((a) => a.path)));
    setUrls(await signedUrls(paths));
    setBusy(false);
  }, [form.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(x: Resposta) {
    if (!confirm("Apagar esta resposta?")) return;
    const r = await supabase.from("mc_respostas").delete().eq("id", x.id);
    if (r.error) setError(errMsg(r.error));
    else load();
  }

  function exportar() {
    baixarCsv(`respostas-${form.titulo.replace(/[^\w]+/g, "-").slice(0, 40)}.csv`, [
      ["Data", "Nome", "Contato", ...form.perguntas.map((q) => q.texto)],
      ...list.map((x) => [
        new Date(x.created_at).toLocaleString("pt-BR"), x.respondente, x.contato,
        ...form.perguntas.map((q) => {
          const v = normResp(x.respostas?.[q.id]);
          const an = (v.anexos ?? []).map((a) => (a.type === "link" ? a.path : `[${a.type.split("/")[0]}: ${a.name}]`)).join(" ");
          return [v.texto, an].filter(Boolean).join(" ");
        }),
      ]),
    ]);
  }

  const Anexos = ({ items }: { items: Anexo[] }) => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((a) => {
        if (a.type === "link") {
          const yt = youtubeId(a.path);
          return (
            <li key={a.path} className="overflow-hidden rounded-xl bg-slate-50 p-2 sm:col-span-2">
              {yt && <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-black"><iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Vídeo" loading="lazy" allowFullScreen className="h-full w-full border-0" /></div>}
              <a href={a.path} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-brand underline">🔗 {a.path}</a>
            </li>
          );
        }
        const u = urls[a.path];
        return (
          <li key={a.path} className="overflow-hidden rounded-xl bg-slate-50 p-2">
            {!u ? <p className="text-sm text-slate-500">{a.name} (carregando…)</p>
              : a.type.startsWith("image/") ? (
                <a href={u} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt={a.name} loading="lazy" className="max-h-64 w-full rounded-lg object-cover" /></a>
              ) : a.type.startsWith("audio/") ? <audio controls preload="none" src={u} className="w-full" />
              : <video controls preload="metadata" src={u} className="max-h-64 w-full rounded-lg bg-black" />}
            <a href={u} download={a.name} className="mt-1 block truncate text-xs text-slate-500 underline">{a.name}</a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-sm font-medium text-brand hover:underline">← Voltar</button>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-xl font-bold">{form.titulo}</h2>{list.length > 0 && <button onClick={exportar} className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Exportar (planilha .csv)</button>}</div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}
      {!busy && list.length === 0 && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Ainda não chegou nenhuma resposta.</p>}
      {list.map((x) => (
        <article key={x.id} className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{x.respondente || "Sem nome"}</h3>
              <p className="text-sm text-slate-500">{[x.contato, new Date(x.created_at).toLocaleString("pt-BR")].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="flex flex-wrap gap-3 text-sm">
              <button onClick={() => prepararCadastro(x)} disabled={preparando === x.id} className="font-semibold text-brand underline disabled:opacity-50">{preparando === x.id ? "Preparando…" : "Criar cadastro no mapa"}</button>
              <button onClick={() => remove(x)} className="text-red-700 underline">Apagar</button>
            </span>
          </div>
          {form.perguntas.map((q) => {
            const v = normResp(x.respostas?.[q.id]);
            if (!v.texto && !v.anexos?.length) return null;
            return (
              <div key={q.id} className="space-y-1">
                <p className="text-sm font-medium text-slate-600">{q.texto}</p>
                {v.texto && <p className="whitespace-pre-line break-words text-slate-900">{v.texto}</p>}
                {v.anexos && v.anexos.length > 0 && <Anexos items={v.anexos} />}
              </div>
            );
          })}
        </article>
      ))}
    </section>
  );
}
