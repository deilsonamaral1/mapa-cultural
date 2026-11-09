"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { campoLink, linkEnvio, waLink, type Envio, type Equipe, type Formulario, type Membro } from "@/lib/campo";
import { errMsg, supabase } from "@/lib/supabase";

/** Enviar um formulário para um agente ou para uma equipe inteira, cada pessoa com o seu link. */
export default function EnviarFormulario({ form, onBack }: { form: Formulario; onBack: () => void }) {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [responderam, setResponderam] = useState<Set<string>>(new Set());
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const load = useCallback(async () => {
    const [e, m, v, r] = await Promise.all([
      supabase.from("mc_equipes").select("*").order("nome"),
      supabase.from("mc_membros").select("*").order("nome"),
      supabase.from("mc_envios").select("id, form_id, membro_id").eq("form_id", form.id),
      supabase.from("mc_respostas").select("envio_id").eq("form_id", form.id).not("envio_id", "is", null),
    ]);
    const err = e.error ?? m.error ?? v.error ?? r.error;
    if (err) setError(errMsg(err));
    else {
      setEquipes((e.data ?? []) as Equipe[]);
      setMembros((m.data ?? []) as Membro[]);
      setEnvios((v.data ?? []) as Envio[]);
      setResponderam(new Set((r.data ?? []).map((x: any) => x.envio_id as string)));
      setError("");
    }
    setBusy(false);
  }, [form.id]);

  useEffect(() => {
    load();
  }, [load]);

  const porMembro = useMemo(() => new Map(envios.map((e) => [e.membro_id, e])), [envios]);
  const toggle = (id: string) => setMarcados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleEquipe = (eq: Equipe) => {
    const ids = membros.filter((m) => m.equipe_id === eq.id).map((m) => m.id);
    const todos = ids.every((i) => marcados.has(i));
    setMarcados((s) => { const n = new Set(s); ids.forEach((i) => (todos ? n.delete(i) : n.add(i))); return n; });
  };

  async function gerar() {
    const novos = [...marcados].filter((id) => !porMembro.has(id));
    if (!marcados.size) return setError("Marque pelo menos um agente ou uma equipe.");
    setError("");
    if (novos.length) {
      const r = await supabase.from("mc_envios").insert(novos.map((membro_id) => ({ form_id: form.id, membro_id })));
      if (r.error) return setError(errMsg(r.error));
    }
    setAviso(`Links prontos para ${marcados.size} agente(s). Mande pelo WhatsApp logo abaixo.`);
    await load();
  }

  const texto = (m: Membro, e: Envio) => `Olá, ${m.nome}! Preciso que você responda este formulário: ${form.titulo}\n${linkEnvio(e.id)}`;

  async function copiar(valor: string, ok: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setAviso(ok);
    } catch {
      prompt("Copie:", valor);
    }
  }

  const enviados = membros.filter((m) => porMembro.has(m.id));
  const pendentes = enviados.filter((m) => !responderam.has(porMembro.get(m.id)!.id)).length;

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-sm font-medium text-brand hover:underline">← Voltar</button>
      <h2 className="font-display text-xl font-bold">Enviar: {form.titulo}</h2>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}

      <div className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Para um grupo de WhatsApp ou para qualquer pessoa</h3>
        <p className="text-sm text-slate-600">Um link só, igual para todos (não identifica quem respondeu).</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button onClick={() => copiar(campoLink(form.id), "Link do grupo copiado.")} className="rounded-full bg-sea px-4 py-2 font-semibold text-white">Copiar link</button>
          <a target="_blank" rel="noopener noreferrer" href={waLink(null, `${form.titulo}\n${campoLink(form.id)}`)} className="rounded-full border border-green-600 px-4 py-2 font-semibold text-green-700">Escolher no WhatsApp</a>
        </div>
      </div>

      {!busy && equipes.length === 0 && (
        <p className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-gray-500">Você ainda não criou equipes. Vá na aba <strong>Equipes</strong>, cadastre os agentes e volte aqui.</p>
      )}

      {equipes.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Para agentes da sua equipe (um link para cada pessoa)</h3>
          {equipes.map((eq) => {
            const lista = membros.filter((m) => m.equipe_id === eq.id);
            if (!lista.length) return null;
            const todos = lista.every((m) => marcados.has(m.id));
            return (
              <div key={eq.id} className="rounded-lg bg-slate-50 p-3">
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={todos} onChange={() => toggleEquipe(eq)} className="!h-5 !w-5" />
                  Equipe toda: {eq.nome} ({lista.length})
                </label>
                <ul className="mt-2 space-y-1 pl-1">
                  {lista.map((m) => (
                    <li key={m.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={marcados.has(m.id)} onChange={() => toggle(m.id)} className="!h-5 !w-5" />
                        {m.nome}{porMembro.has(m.id) && <span className="text-xs text-slate-500">(já tem link)</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <button onClick={gerar} className="rounded-full bg-sea px-5 py-2.5 font-semibold text-white hover:bg-sea-deep">Gerar links dos marcados</button>
        </div>
      )}

      {enviados.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Enviados ({enviados.length}) · aguardando resposta: {pendentes}</h3>
            <button onClick={() => copiar(enviados.map((m) => texto(m, porMembro.get(m.id)!)).join("\n\n"), "Todas as mensagens copiadas.")} className="rounded-full border px-4 py-2 text-sm font-semibold">Copiar todas as mensagens</button>
          </div>
          <ul className="divide-y">
            {enviados.map((m) => {
              const e = porMembro.get(m.id)!;
              const ok = responderam.has(e.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.nome}</p>
                    <p className={`text-xs ${ok ? "text-green-700" : "text-amber-700"}`}>{ok ? "✓ Respondeu" : "Aguardando"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <a target="_blank" rel="noopener noreferrer" href={waLink(m.telefone, texto(m, e))} className="rounded-full border border-green-600 px-4 py-2 font-semibold text-green-700">WhatsApp</a>
                    {m.email && <a href={`mailto:${m.email}?subject=${encodeURIComponent(form.titulo)}&body=${encodeURIComponent(texto(m, e))}`} className="rounded-full border px-4 py-2">E-mail</a>}
                    <button onClick={() => copiar(linkEnvio(e.id), `Link de ${m.nome} copiado.`)} className="rounded-full border px-4 py-2">Copiar link</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
