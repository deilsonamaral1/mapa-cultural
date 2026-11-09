"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { errMsg, supabase } from "@/lib/supabase";

type F = { id: string; titulo: string; descricao: string | null };

/** Formulários que a equipe publicou para qualquer pessoa responder (sem login). */
export default function FormulariosPage() {
  const [list, setList] = useState<F[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("mc_formularios_publicos").then((r) => {
      if (r.error) setError(errMsg(r.error));
      else setList((r.data ?? []) as F[]);
    });
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl font-extrabold">Formulários</h1>
        <p className="mt-2 mb-8 max-w-xl text-slate-600">Participe do mapeamento cultural respondendo aos formulários abertos pela equipe. Você pode mandar texto, fotos, áudio e vídeo.</p>
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!list && !error && <p className="text-slate-500">Carregando…</p>}
        {list && list.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">Não há formulários abertos no momento.</p>}
        <ul className="space-y-3">
          {list?.map((f) => (
            <li key={f.id}>
              <Link href={`/campo?f=${f.id}`} className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <h2 className="font-display text-xl font-semibold">{f.titulo}</h2>
                {f.descricao && <p className="mt-1 line-clamp-3 text-slate-600">{f.descricao}</p>}
                <span className="mt-3 inline-block font-semibold text-brand">Responder →</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
