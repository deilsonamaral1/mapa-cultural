"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/SiteHeader";
import { MAX_ANEXOS, MAX_ANEXO_MB, cleanPerguntas, uploadAnexo, type Anexo, type Formulario } from "@/lib/campo";
import { errMsg, supabase } from "@/lib/supabase";

type Valores = Record<string, string>;

/** Formulário de campo: o agente abre o link, responde (com fotos, áudio e vídeo) e toca em Salvar. Sem login. */
export default function CampoPage() {
  const [form, setForm] = useState<Formulario | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "sent">("loading");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [vals, setVals] = useState<Valores>({});
  const [anexos, setAnexos] = useState<Record<string, Anexo[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const respId = useRef(crypto.randomUUID());
  const formId = useRef("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("f") ?? "";
    formId.current = id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return setState("missing");
    supabase.rpc("mc_form_publico", { p_id: id }).then((r) => {
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (r.error || !row) return setState("missing");
      setForm({ id: row.id, titulo: row.titulo, descricao: row.descricao, perguntas: cleanPerguntas(row.perguntas) });
      setState("ok");
      try {
        const d = JSON.parse(localStorage.getItem(`mc-campo-${id}`) ?? "null");
        if (d) {
          setNome(d.nome ?? "");
          setContato(d.contato ?? "");
          setVals(d.vals ?? {});
        }
      } catch {
        /* sem rascunho */
      }
    });
  }, []);

  // guarda o texto no aparelho: se a internet cair no campo, nada se perde
  useEffect(() => {
    if (state !== "ok") return;
    try {
      localStorage.setItem(`mc-campo-${formId.current}`, JSON.stringify({ nome, contato, vals }));
    } catch {
      /* ignora */
    }
  }, [nome, contato, vals, state]);

  async function addFiles(qid: string, files: FileList | null) {
    if (!files?.length || !form) return;
    setError("");
    setUploading(qid);
    try {
      const cur = anexos[qid] ?? [];
      for (const f of Array.from(files)) {
        if (cur.length >= MAX_ANEXOS) {
          setError(`Máximo de ${MAX_ANEXOS} arquivos por pergunta.`);
          break;
        }
        const a = await uploadAnexo(form.id, respId.current, f);
        cur.push(a);
        setAnexos((s) => ({ ...s, [qid]: [...cur] }));
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    if (uploading) return setError("Aguarde o envio dos arquivos terminar.");
    for (const q of form.perguntas) {
      if (!q.obrigatoria) continue;
      const ok = q.tipo === "midia" ? (anexos[q.id]?.length ?? 0) > 0 : (vals[q.id] ?? "").trim() !== "";
      if (!ok) return setError(`Responda: "${q.texto}"`);
    }
    const respostas: Record<string, string | Anexo[]> = {};
    for (const q of form.perguntas) {
      if (q.tipo === "midia") {
        if (anexos[q.id]?.length) respostas[q.id] = anexos[q.id];
      } else if ((vals[q.id] ?? "").trim()) respostas[q.id] = vals[q.id].trim();
    }
    setBusy(true);
    const r = await supabase.from("mc_respostas").insert({
      id: respId.current,
      form_id: form.id,
      respondente: nome.trim() || null,
      contato: contato.trim() || null,
      respostas,
    });
    setBusy(false);
    if (r.error) return setError(`Não foi possível salvar: ${errMsg(r.error)}`);
    try {
      localStorage.removeItem(`mc-campo-${form.id}`);
    } catch {
      /* ignora */
    }
    setState("sent");
  }

  function again() {
    respId.current = crypto.randomUUID();
    setNome("");
    setContato("");
    setVals({});
    setAnexos({});
    setState("ok");
  }

  return (
    <div className="min-h-screen bg-cal pb-16">
      <header className="border-b border-slate-200 bg-white px-4 py-3"><div className="mx-auto max-w-xl"><Logo /></div></header>
      <main className="mx-auto max-w-xl px-4 py-6">
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

            {form.perguntas.map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{i + 1}. {q.texto}{q.obrigatoria && <span className="text-red-600"> *</span>}</p>

                {q.tipo === "texto" && <input value={vals[q.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} aria-label={q.texto} />}
                {q.tipo === "longo" && <textarea rows={5} value={vals[q.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} aria-label={q.texto} />}
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
                {q.tipo === "midia" && (
                  <div className="space-y-2">
                    {(anexos[q.id] ?? []).map((a) => (
                      <div key={a.path} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <span className="truncate">{a.type.startsWith("image/") ? "📷" : a.type.startsWith("audio/") ? "🎙️" : "🎬"} {a.name}</span>
                        <button type="button" aria-label="Remover" onClick={() => setAnexos((s) => ({ ...s, [q.id]: (s[q.id] ?? []).filter((x) => x.path !== a.path) }))} className="grid h-9 w-9 shrink-0 place-items-center text-slate-500">×</button>
                      </div>
                    ))}
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-400 bg-white px-4 py-4 text-base font-semibold text-slate-700 active:bg-slate-50">
                      {uploading === q.id ? "Enviando… não feche a página" : "+ Foto, áudio ou vídeo"}
                      <input type="file" multiple accept="image/*,audio/*,video/*" className="sr-only" disabled={!!uploading}
                        onChange={(e) => { addFiles(q.id, e.target.files); e.target.value = ""; }} />
                    </label>
                    <p className="text-xs text-slate-500">Até {MAX_ANEXO_MB} MB por arquivo. Vídeos grandes: grave um trecho menor.</p>
                  </div>
                )}
              </div>
            ))}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy || !!uploading} className="w-full rounded-full bg-sea px-6 py-4 text-lg font-semibold text-white shadow-lift disabled:opacity-50">
              {busy ? "Salvando…" : uploading ? "Enviando arquivos…" : "Salvar e enviar"}
            </button>
            <p className="text-center text-xs text-slate-500">O que você escreve fica guardado neste aparelho até você enviar.</p>
          </form>
        )}
      </main>
    </div>
  );
}
