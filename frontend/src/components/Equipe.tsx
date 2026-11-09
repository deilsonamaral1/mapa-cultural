"use client";

import { useCallback, useEffect, useState } from "react";
import RoleBadge from "@/components/RoleBadge";
import { T, errMsg, supabase } from "@/lib/supabase";
import type { Papel } from "@/lib/useUser";

type Membro = { id: string; email: string; nome: string | null; papel: Papel };

/** Quem é administrador ou moderador: lista, adiciona por e-mail, muda o papel e remove. A regra de segurança está no banco (mc_definir_papel). */
export default function Equipe({ meId }: { meId: string }) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("moderador");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.from(T.perfis).select("id, email, nome, papel").in("papel", ["admin", "moderador"]).order("papel").order("email");
    if (r.error) setError(errMsg(r.error));
    else setMembros((r.data ?? []) as Membro[]);
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function definir(alvo: string, novo: Papel) {
    setSaving(true);
    setError("");
    setOk("");
    const r = await supabase.rpc("mc_definir_papel", { p_email: alvo, p_papel: novo });
    if (r.error) setError(errMsg(r.error));
    else {
      setOk(novo === "agente" ? `${alvo} voltou a ser agente.` : `${alvo} agora é ${novo === "admin" ? "administrador" : "moderador"}.`);
      setEmail("");
      await load();
    }
    setSaving(false);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-sky-50 p-3 text-sm text-slate-700">
        <strong>Administrador</strong> faz tudo, inclusive esta tela e os formulários de campo. <strong>Moderador</strong> aprova cadastros e textos do blog e vê os números, mas não mexe na equipe.
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) definir(email.trim(), papel); }} className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Adicionar à equipe</h2>
        <p className="mt-1 text-sm text-slate-600">A pessoa precisa já ter criado a conta no site. Digite o e-mail dela.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" aria-label="E-mail da pessoa" />
          <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)} aria-label="Papel" className="sm:!w-44">
            <option value="moderador">Moderador</option>
            <option value="admin">Administrador</option>
          </select>
          <button disabled={saving} className="shrink-0 rounded-xl bg-sea px-5 py-2.5 text-sm font-semibold text-white hover:bg-sea-deep disabled:opacity-50">Adicionar</button>
        </div>
      </form>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold">Equipe ({membros.length})</h2>
        {busy && <p className="text-gray-500">Carregando…</p>}
        <ul className="space-y-2">
          {membros.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{a.nome || a.email}{a.id === meId && <span className="ml-2 text-xs text-slate-500">(você)</span>}</div>
                {a.nome && <div className="truncate text-sm text-slate-500">{a.email}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge papel={a.papel} />
                {a.id !== meId && (
                  <>
                    <button disabled={saving} onClick={() => definir(a.email, a.papel === "admin" ? "moderador" : "admin")} className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
                      Tornar {a.papel === "admin" ? "moderador" : "administrador"}
                    </button>
                    <button disabled={saving} onClick={() => confirm(`Remover ${a.email} da equipe?`) && definir(a.email, "agente")} className="rounded-full border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Remover</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
