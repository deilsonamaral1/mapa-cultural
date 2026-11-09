"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/SiteHeader";
import {
  MAX_ANEXO_MB, cleanPerguntas, ehErroDeRede, linkAnexo, uploadAnexo, validarAnexo, visivel,
  type Anexo, type Formulario, type RespostaItem,
} from "@/lib/campo";
import { listarPendentes, removerPendente, salvarPendente, type ItemPendente, type Pendente } from "@/lib/pendentes";
import { errMsg, supabase } from "@/lib/supabase";

type Valores = Record<string, string>;
type Local = { name: string; type: string; file: File }; // arquivo escolhido que ainda não subiu (sem internet)

const icone = (t: string) => (t === "link" ? "🔗" : t.startsWith("image/") ? "📷" : t.startsWith("audio/") ? "🎙️" : "🎬");

/** Formulário de campo: o agente abre o link, responde (com fotos, áudio e vídeo) e toca em Salvar. Sem login. Funciona sem sinal. */
export default function CampoPage() {
  const [form, setForm] = useState<Formulario | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "sent" | "queued">("loading");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [vals, setVals] = useState<Valores>({});
  const [anexos, setAnexos] = useState<Record<string, Anexo[]>>({});
  const [locais, setLocais] = useState<Record<string, Local[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fila, setFila] = useState(0);
  const [enviandoFila, setEnviandoFila] = useState(false);
  const respId = useRef(crypto.randomUUID());
  const formId = useRef("");
  const envioId = useRef<string | null>(null);
  const chave = useRef(""); // identifica o rascunho e a cópia do formulário neste aparelho

  /** Envia o que ficou guardado no aparelho (respostas feitas sem sinal). */
  const esvaziarFila = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    let lista: Pendente[] = [];
    try {
      lista = await listarPendentes();
    } catch {
      return;
    }
    setFila(lista.length);
    if (!lista.length || !navigator.onLine) return;
    setEnviandoFila(true);
    for (const p of lista) {
      try {
        const respostas: Record<string, RespostaItem> = {};
        for (const [qid, texto] of Object.entries(p.vals)) if (texto.trim()) respostas[qid] = { texto: texto.trim() };
        for (const it of p.itens) {
          const a: Anexo = it.file ? await uploadAnexo(p.formId, p.id, new File([it.file], it.name, { type: it.type })) : { path: it.path!, name: it.name, type: it.type };
          const cur = respostas[it.qid] ?? {};
          respostas[it.qid] = { ...cur, anexos: [...(cur.anexos ?? []), a] };
        }
        const r = await supabase.from("mc_respostas").insert({ id: p.id, form_id: p.formId, envio_id: p.envioId ?? null, respondente: p.nome || null, contato: p.contato || null, respostas });
        // 23505 = já tinha chegado antes (envio repetido): pode apagar do aparelho
        if (!r.error || r.error.code === "23505") await removerPendente(p.id);
      } catch {
        /* sem sinal de novo: tenta na próxima vez */
      }
    }
    try {
      setFila((await listarPendentes()).length);
    } catch {
      /* ignora */
    }
    setEnviandoFila(false);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get("e") ?? "";
    const id = e || (q.get("f") ?? "");
    formId.current = id;
    chave.current = id;
    envioId.current = e || null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return setState("missing");

    const abrir = (f: Formulario) => {
      setForm(f);
      setState("ok");
      if ((f as { nome?: string }).nome) setNome((f as { nome?: string }).nome!); // link pessoal: já vem com o nome do agente
      try {
        const d = JSON.parse(localStorage.getItem(`mc-campo-${id}`) ?? "null");
        if (d) {
          if (d.nome) setNome(d.nome);
          setContato(d.contato ?? "");
          setVals(d.vals ?? {});
        }
      } catch {
        /* sem rascunho */
      }
    };
    const guardado = (): Formulario | null => {
      try {
        return JSON.parse(localStorage.getItem(`mc-campo-form-${id}`) ?? "null");
      } catch {
        return null;
      }
    };

    const consulta = e ? supabase.rpc("mc_envio_publico", { p_id: id }) : supabase.rpc("mc_form_publico", { p_id: id });
    consulta.then((r) => {
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (row) {
        const f: Formulario & { nome?: string } = { id: e ? row.form_id : row.id, titulo: row.titulo, descricao: row.descricao, perguntas: cleanPerguntas(row.perguntas), nome: row.nome };
        try {
          localStorage.setItem(`mc-campo-form-${id}`, JSON.stringify(f)); // para abrir mesmo sem sinal
        } catch {
          /* ignora */
        }
        return abrir(f);
      }
      // sem resposta do servidor: se foi falta de sinal, usa a cópia guardada; se o formulário foi encerrado, avisa
      const g = guardado();
      if (r.error && g) return abrir(g);
      setState("missing");
    });
    esvaziarFila();
    const volta = () => esvaziarFila();
    window.addEventListener("online", volta);
    return () => window.removeEventListener("online", volta);
  }, [esvaziarFila]);

  // guarda o texto no aparelho: se a internet cair no campo, nada se perde
  useEffect(() => {
    if (state !== "ok") return;
    try {
      localStorage.setItem(`mc-campo-${chave.current}`, JSON.stringify({ nome, contato, vals }));
    } catch {
      /* ignora */
    }
  }, [nome, contato, vals, state]);

  async function addFiles(qid: string, files: FileList | null) {
    if (!files?.length || !form) return;
    setError("");
    setUploading(qid);
    try {
      for (const f of Array.from(files)) {
        validarAnexo(f); // tipo e tamanho: erro aqui não é falta de sinal
        try {
          if (!navigator.onLine) throw new TypeError("offline");
          const a = await uploadAnexo(form.id, respId.current, f);
          setAnexos((s) => ({ ...s, [qid]: [...(s[qid] ?? []), a] }));
        } catch (err) {
          if (!ehErroDeRede(err)) throw err;
          setLocais((s) => ({ ...s, [qid]: [...(s[qid] ?? []), { name: f.name, type: f.type, file: f }] }));
        }
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(null);
    }
  }

  function addLink(qid: string) {
    const a = linkAnexo(links[qid] ?? "");
    if (!a) return setError("Esse link não parece válido. Cole o endereço completo (https://…).");
    setError("");
    setAnexos((s) => ({ ...s, [qid]: [...(s[qid] ?? []), a] }));
    setLinks((l) => ({ ...l, [qid]: "" }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    if (uploading) return setError("Aguarde o envio dos arquivos terminar.");
    const vis = form.perguntas.filter((q) => visivel(q, vals));
    for (const q of vis) {
      if (!q.obrigatoria) continue;
      const ok = (anexos[q.id]?.length ?? 0) > 0 || (locais[q.id]?.length ?? 0) > 0 || (vals[q.id] ?? "").trim() !== "";
      if (!ok) return setError(`Responda: "${q.texto}"`);
    }

    const visVals: Valores = {};
    const respostas: Record<string, RespostaItem> = {};
    for (const q of vis) {
      const texto = (vals[q.id] ?? "").trim();
      if (texto) visVals[q.id] = texto;
      const an = anexos[q.id] ?? [];
      if (texto || an.length) respostas[q.id] = { ...(texto ? { texto } : {}), ...(an.length ? { anexos: an } : {}) };
    }
    const temLocal = vis.some((q) => (locais[q.id]?.length ?? 0) > 0);

    async function guardarNoAparelho() {
      const itens: ItemPendente[] = [];
      for (const q of vis) {
        for (const a of anexos[q.id] ?? []) itens.push({ qid: q.id, name: a.name, type: a.type, path: a.path });
        for (const l of locais[q.id] ?? []) itens.push({ qid: q.id, name: l.name, type: l.type, file: l.file });
      }
      await salvarPendente({ id: respId.current, formId: form!.id, envioId: envioId.current ?? undefined, titulo: form!.titulo, nome: nome.trim(), contato: contato.trim(), vals: visVals, itens, salvoEm: Date.now() });
    }

    setBusy(true);
    try {
      if (!temLocal && navigator.onLine) {
        const r = await supabase.from("mc_respostas").insert({ id: respId.current, form_id: form.id, envio_id: envioId.current, respondente: nome.trim() || null, contato: contato.trim() || null, respostas });
        if (r.error) {
          if (!ehErroDeRede(r.error)) throw r.error;
          await guardarNoAparelho();
          setFila((n) => n + 1);
          return finalizar("queued");
        }
        return finalizar("sent");
      }
      // sem sinal (ou arquivos ainda no aparelho): guarda tudo e envia quando voltar
      await guardarNoAparelho();
      setFila((n) => n + 1);
      finalizar("queued");
      esvaziarFila();
    } catch (err) {
      setError(`Não foi possível salvar: ${errMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function finalizar(s: "sent" | "queued") {
    try {
      localStorage.removeItem(`mc-campo-${chave.current}`);
    } catch {
      /* ignora */
    }
    setState(s);
  }

  function again() {
    respId.current = crypto.randomUUID();
    setNome("");
    setContato("");
    setVals({});
    setAnexos({});
    setLocais({});
    setState("ok");
  }

  return (
    <div className="min-h-screen bg-cal pb-16">
      <header className="border-b border-slate-200 bg-white px-4 py-3"><div className="mx-auto max-w-xl"><Logo /></div></header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        {fila > 0 && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span>{fila} resposta(s) guardada(s) neste aparelho, aguardando sinal para enviar.</span>
            <button type="button" onClick={esvaziarFila} disabled={enviandoFila} className="shrink-0 rounded-full bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{enviandoFila ? "Enviando…" : "Enviar agora"}</button>
          </div>
        )}

        {state === "loading" && <p className="text-slate-500">Carregando…</p>}
        {state === "missing" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h1 className="font-display text-xl font-semibold">Formulário indisponível</h1>
            <p className="mt-2 text-sm text-slate-600">Este link não existe ou o formulário já foi encerrado. Peça um novo link à equipe.</p>
          </div>
        )}
        {state === "sent" && (
          <div className="rounded-2xl border border-green-200 bg-white p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-3xl text-green-700">✓</span>
            <h1 className="mt-3 font-display text-2xl font-semibold">Respostas enviadas!</h1>
            <p className="mt-2 text-slate-600">Obrigado. A equipe já recebeu o que você mandou.</p>
            <button onClick={again} className="mt-5 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700">Responder de novo</button>
          </div>
        )}
        {state === "queued" && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-3xl text-amber-700">📥</span>
            <h1 className="mt-3 font-display text-2xl font-semibold">Guardado no aparelho</h1>
            <p className="mt-2 text-slate-600">Sem sinal agora. Nada se perdeu: assim que a internet voltar, abra este mesmo link de novo e a resposta é enviada sozinha.</p>
            <button onClick={again} className="mt-5 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700">Fazer outra resposta</button>
          </div>
        )}

        {state === "ok" && form && (
          <form onSubmit={save} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold leading-tight">{form.titulo}</h1>
              {form.descricao && <p className="mt-2 whitespace-pre-line text-slate-600">{form.descricao}</p>}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div><label>Seu nome<input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></label></div>
              <div><label>Telefone ou e-mail (opcional)<input value={contato} onChange={(e) => setContato(e.target.value)} autoComplete="off" /></label></div>
            </div>

            {form.perguntas.filter((q) => visivel(q, vals)).map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{i + 1}. {q.texto}{q.obrigatoria && <span className="text-red-600"> *</span>}</p>

                {q.tipo === "texto" && <input value={vals[q.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} aria-label={q.texto} />}
                {q.tipo === "longo" && <textarea rows={5} value={vals[q.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} aria-label={q.texto} />}
                {q.tipo === "data" && <input type="date" value={vals[q.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} aria-label={q.texto} />}
                {q.tipo === "escala" && (
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.texto}>
                    {["1", "2", "3", "4", "5"].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={vals[q.id] === n} onClick={() => setVals((v) => ({ ...v, [q.id]: n }))}
                        className={`rounded-xl border py-3 text-lg font-semibold ${vals[q.id] === n ? "border-sea bg-sea text-white" : "border-slate-300 bg-white text-slate-700"}`}>{n}</button>
                    ))}
                  </div>
                )}
                {q.tipo === "escolha" && (
                  <div className="space-y-2">
                    {(q.opcoes ?? []).map((o) => (
                      <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${vals[q.id] === o ? "border-sea bg-sea/5" : "border-slate-300"}`}>
                        <input type="radio" name={q.id} checked={vals[q.id] === o} onChange={() => setVals((v) => ({ ...v, [q.id]: o }))} className="!h-5 !w-5 !p-0" />
                        <span className="text-base">{o}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {(anexos[q.id] ?? []).map((a) => (
                    <div key={a.path} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="truncate">{icone(a.type)} {a.name}</span>
                      <button type="button" aria-label="Remover" onClick={() => setAnexos((s) => ({ ...s, [q.id]: (s[q.id] ?? []).filter((x) => x.path !== a.path) }))} className="grid h-9 w-9 shrink-0 place-items-center text-slate-500">×</button>
                    </div>
                  ))}
                  {(locais[q.id] ?? []).map((l, k) => (
                    <div key={`${l.name}-${k}`} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                      <span className="truncate">{icone(l.type)} {l.name} <em className="text-amber-700">(no aparelho, sobe com sinal)</em></span>
                      <button type="button" aria-label="Remover" onClick={() => setLocais((s) => ({ ...s, [q.id]: (s[q.id] ?? []).filter((_, j) => j !== k) }))} className="grid h-9 w-9 shrink-0 place-items-center text-slate-500">×</button>
                    </div>
                  ))}
                  <p className="text-xs font-medium text-slate-500">{uploading === q.id ? "Enviando… não feche a página" : "Quer mostrar também? Adicione:"}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([["📷", "Foto", "image/*"], ["🎙️", "Áudio", "audio/*"], ["🎬", "Vídeo", "video/*"]] as const).map(([ico, nm, accept]) => (
                      <label key={nm} className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 bg-white px-2 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50 ${uploading ? "opacity-50" : ""}`}>
                        <span className="text-xl" aria-hidden="true">{ico}</span>{nm}
                        <input type="file" multiple accept={accept} className="sr-only" disabled={!!uploading}
                          onChange={(e) => { addFiles(q.id, e.target.files); e.target.value = ""; }} />
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={links[q.id] ?? ""} onChange={(e) => setLinks((l) => ({ ...l, [q.id]: e.target.value }))} placeholder="Ou cole um link (YouTube, Drive…)" aria-label="Link de vídeo ou áudio"
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addLink(q.id); } }} />
                    <button type="button" onClick={() => addLink(q.id)} className="shrink-0 rounded-xl border border-slate-300 px-4 font-semibold">Adicionar</button>
                  </div>
                  <p className="text-xs text-slate-500">Arquivos de até {MAX_ANEXO_MB} MB cada. Vídeo maior? Envie para o YouTube (como "não listado") ou Google Drive e cole o link acima.</p>
                </div>
              </div>
            ))}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy || !!uploading} className="w-full rounded-full bg-sea px-6 py-4 text-lg font-semibold text-white shadow-lift disabled:opacity-50">
              {busy ? "Salvando…" : uploading ? "Enviando arquivos…" : "Salvar e enviar"}
            </button>
            <p className="text-center text-xs text-slate-500">Sem sinal? Toque em Salvar mesmo assim: a resposta fica neste aparelho e é enviada quando a internet voltar.</p>
          </form>
        )}
      </main>
    </div>
  );
}
