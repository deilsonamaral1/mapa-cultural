"use client";

import { useEffect, useState } from "react";
import { KINDS } from "@/lib/mapas";
import { T, errMsg, supabase } from "@/lib/supabase";

type Linha = { status: string; created_at: string; data: any };

const Barra = ({ rotulo, valor, max, cor = "#0f4c75" }: { rotulo: string; valor: number; max: number; cor?: string }) => (
  <li className="flex items-center gap-3 text-sm">
    <span className="w-32 shrink-0 truncate sm:w-44">{rotulo}</span>
    <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${max ? Math.max(3, (valor / max) * 100) : 0}%`, background: cor }} /></span>
    <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{valor}</span>
  </li>
);

/** Painel de números da equipe: cadastros por situação, tipo, área e mês; textos; formulários e contas. */
export default function Numeros({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<Linha[]>([]);
  const [extra, setExtra] = useState<{ posts: Record<string, number>; respostas: number | null; contas: number | null }>({ posts: {}, respostas: null, contas: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const c = await supabase.from(T.cadastros).select("status, created_at, data").limit(5000);
      if (c.error) {
        setError(errMsg(c.error));
        setBusy(false);
        return;
      }
      setRows((c.data ?? []) as Linha[]);
      const posts: Record<string, number> = {};
      for (const s of ["pending", "published", "rejected"]) {
        const r = await supabase.from("mc_posts").select("id", { count: "exact", head: true }).eq("status", s);
        posts[s] = r.count ?? 0;
      }
      let respostas: number | null = null;
      let contas: number | null = null;
      if (isAdmin) {
        respostas = (await supabase.from("mc_respostas").select("id", { count: "exact", head: true })).count;
        contas = (await supabase.from(T.perfis).select("id", { count: "exact", head: true })).count;
      }
      setExtra({ posts, respostas, contas });
      setBusy(false);
    })();
  }, [isAdmin]);

  const por = (f: (r: Linha) => string | string[]) => {
    const m = new Map<string, number>();
    for (const r of rows) for (const k of ([] as string[]).concat(f(r))) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const status = por((r) => r.status);
  const tipo = por((r) => r.data?.kind ?? "?");
  const area = por((r) => (Array.isArray(r.data?.areas) ? r.data.areas : [])).slice(0, 8);
  const meses = (() => {
    const out: [string, number][] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      out.push([d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), rows.filter((r) => { const x = new Date(r.created_at); return `${x.getFullYear()}-${x.getMonth()}` === key; }).length]);
    }
    return out;
  })();

  const rotuloStatus: Record<string, string> = { pending: "Pendentes", approved: "Aprovados", rejected: "Rejeitados" };
  const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="rounded-xl border bg-white p-4 shadow-sm"><h3 className="mb-3 font-display text-lg font-semibold">{titulo}</h3><ul className="space-y-2">{children}</ul></section>
  );

  if (busy) return <p className="text-gray-500">Calculando…</p>;
  if (error) return <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Cadastros", rows.length], ["Pendentes", rows.filter((r) => r.status === "pending").length], ["Textos publicados", extra.posts.published ?? 0], isAdmin ? ["Contas", extra.contas ?? 0] : ["Textos pendentes", extra.posts.pending ?? 0]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border bg-white p-4 text-center shadow-sm"><div className="font-display text-3xl font-bold text-sea">{v}</div><div className="text-sm text-slate-600">{l}</div></div>
        ))}
      </div>
      <Bloco titulo="Cadastros por situação">{status.map(([k, v]) => <Barra key={k} rotulo={rotuloStatus[k] ?? k} valor={v} max={status[0]?.[1] ?? 1} cor={k === "approved" ? "#2f9e44" : k === "rejected" ? "#c0392b" : "#d98e04"} />)}</Bloco>
      <Bloco titulo="Cadastros por tipo">{tipo.map(([k, v]) => <Barra key={k} rotulo={(KINDS as any)[k]?.plural ?? k} valor={v} max={tipo[0]?.[1] ?? 1} cor={(KINDS as any)[k]?.color} />)}</Bloco>
      <Bloco titulo="Áreas mais cadastradas">{area.length ? area.map(([k, v]) => <Barra key={k} rotulo={k} valor={v} max={area[0][1]} />) : <li className="text-sm text-slate-500">Sem dados ainda.</li>}</Bloco>
      <Bloco titulo="Cadastros enviados por mês">{meses.map(([k, v]) => <Barra key={k} rotulo={k} valor={v} max={Math.max(1, ...meses.map((m) => m[1]))} />)}</Bloco>
      {isAdmin && extra.respostas != null && <p className="text-sm text-slate-600">Respostas recebidas nos formulários de campo: <strong>{extra.respostas}</strong>.</p>}
      <p className="text-xs text-slate-500">Visitas ao site não são contadas aqui. Para isso dá para ligar um contador sem cookies (ex.: Cloudflare Web Analytics, grátis).</p>
    </div>
  );
}
