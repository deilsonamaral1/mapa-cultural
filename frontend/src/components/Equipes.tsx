"use client";

import { useCallback, useEffect, useState } from "react";
import type { Equipe, Membro } from "@/lib/campo";
import { errMsg, supabase } from "@/lib/supabase";

/** Equipes de agentes de campo: o administrador cria equipes e cadastra os agentes (nome e WhatsApp). */
export default function Equipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [nome, setNome] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [e, m] = await Promise.all([
      supabase.from("mc_equipes").select("*").order("created_at", { ascending: false }),
      supabase.from("mc_membros").select("*").order("nome"),
    ]);
    if (e.error || m.error) setError(errMsg(e.error ?? m.error));
    else {
      setEquipes((e.data ?? []) as Equipe[]);
      setMembros((m.data ?? []) as Membro[]);
      setError("");
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) return;
    const r = await supabase.from("mc_equipes").insert({ nome: nome.trim() }).select("id").single();
    if (r.error) return setError(errMsg(r.error));
    setNome("");
    setAberta(r.data.id);
    load();
  }

  async function apagar(eq: Equipe, n: number) {
    if (!confirm(`Apagar a equipe "${eq.nome}" e ${n} agente(s)? As respostas já recebidas continuam guardadas.`)) return;
    const r = await supabase.from("mc_equipes").delete().eq("id", eq.id);
    if (r.error) setError(errMsg(r.error));
    else load();
  }

  return (
    <section className="space-y-4">
      <p className="max-w-lg text-sm text-slate-600">Monte equipes de agentes de campo. Depois, em Formulários de campo, você envia um formulário para uma pessoa ou para a equipe toda, cada um com o seu link.</p>
      <form onSubmit={criar} className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da nova equipe (ex.: Mapeamento Litoral)" aria-label="Nome da equipe" required />
        <button className="shrink-0 rounded-full bg-sea px-5 py-2.5 font-semibold text-white hover:bg-sea-deep">Criar equipe</button>
      </form>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && <p className="text-gray-500">Carregando…</p>}
      {!busy && !error && equipes.length === 0 && <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">Nenhuma equipe ainda.</p>}

      <ul className="space-y-3">
        {equipes.map((eq) => {
          const lista = membros.filter((m) => m.equipe_id === eq.id);
          return (
            <li key={eq.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => setAberta(aberta === eq.id ? null : eq.id)} className="min-w-0 text-left" aria-expanded={aberta === eq.id}>
                  <h2 className="font-display text-lg font-semibold">{eq.nome}</h2>
                  <p className="text-sm text-slate-500">{lista.length} agente(s) {aberta === eq.id ? "▲" : "▼"}</p>
                </button>
                <button onClick={() => apagar(eq, lista.length)} className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700">Apagar equipe</button>
              </div>
              {aberta === eq.id && <Agentes equipe={eq} lista={lista} onChange={load} onError={setError} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Agentes({ equipe, lista, onChange, onError }: { equipe: Equipe; lista: Membro[]; onChange: () => void; onError: (m: string) => void }) {
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [lote, setLote] = useState("");

  async function adicionar(ev: React.FormEvent) {
    ev.preventDefault();
    const r = await supabase.from("mc_membros").insert({ equipe_id: equipe.id, nome: nome.trim(), telefone: tel.trim() || null, email: email.trim() || null });
    if (r.error) return onError(errMsg(r.error));
    setNome("");
    setTel("");
    setEmail("");
    onChange();
  }

  /** Várias pessoas de uma vez: uma por linha, "Nome, WhatsApp, e-mail". */
  async function adicionarLote() {
    const rows = lote
      .split("\n")
      .map((l) => l.split(/[;,\t]/).map((x) => x.trim()))
      .filter((c) => c[0])
      .map((c) => ({ equipe_id: equipe.id, nome: c[0], telefone: c[1] || null, email: c[2] || null }));
    if (!rows.length) return;
    const r = await supabase.from("mc_membros").insert(rows);
    if (r.error) return onError(errMsg(r.error));
    setLote("");
    onChange();
  }

  async function remover(m: Membro) {
    if (!confirm(`Remover ${m.nome} da equipe?`)) return;
    const r = await supabase.from("mc_membros").delete().eq("id", m.id);
    if (r.error) onError(errMsg(r.error));
    else onChange();
  }

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {lista.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {lista.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.nome}</p>
                <p className="truncate text-sm text-slate-500">{[m.telefone, m.email].filter(Boolean).join(" · ") || "sem contato"}</p>
              </div>
              <button onClick={() => remover(m)} aria-label={`Remover ${m.nome}`} className="grid h-9 w-9 shrink-0 place-items-center text-slate-500">×</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={adicionar} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do agente" aria-label="Nome do agente" required />
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="WhatsApp (com DDD)" aria-label="WhatsApp" inputMode="tel" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" aria-label="E-mail" />
        <button className="rounded-full bg-sea px-5 py-2.5 font-semibold text-white">Adicionar</button>
      </form>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand">Adicionar vários de uma vez</summary>
        <textarea rows={4} value={lote} onChange={(e) => setLote(e.target.value)} className="mt-2" placeholder={"Uma pessoa por linha: nome, WhatsApp, e-mail\nMaria Silva, 85 99999-0000\nJoão Souza, 85 98888-1111, joao@email.com"} aria-label="Lista de agentes" />
        <button type="button" onClick={adicionarLote} className="mt-2 rounded-full border px-4 py-2 font-semibold">Adicionar todos</button>
      </details>
    </div>
  );
}
