"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type F = { envio_id: string; form_id: string; titulo: string; descricao: string | null; enviado_em: string; respondido: boolean };

/** Painel do agente: formulários que o administrador enviou para a conta dele. Some quando não há nenhum. */
export default function FormulariosParaMim() {
  const [list, setList] = useState<F[]>([]);

  useEffect(() => {
    supabase.rpc("mc_meus_formularios").then((r) => {
      if (!r.error) setList((r.data ?? []) as F[]);
    });
  }, []);

  if (!list.length) return null;
  const faltam = list.filter((f) => !f.respondido).length;

  return (
    <section className="space-y-3 rounded-2xl border border-sea/20 bg-sea/5 p-4">
      <div>
        <h2 className="font-display text-xl font-bold">Formulários para você{faltam > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-xs font-bold text-white">{faltam} novo(s)</span>}</h2>
        <p className="text-sm text-slate-600">Enviados pela equipe. Você pode escrever e mandar fotos, áudio e vídeo.</p>
      </div>
      <ul className="space-y-2">
        {list.map((f) => (
          <li key={f.envio_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{f.titulo}</p>
              {f.descricao && <p className="line-clamp-2 text-sm text-slate-600">{f.descricao}</p>}
              <p className={`mt-0.5 text-xs ${f.respondido ? "text-green-700" : "text-amber-700"}`}>{f.respondido ? "✓ Você já respondeu" : "Aguardando a sua resposta"}</p>
            </div>
            <Link href={`/campo?e=${f.envio_id}`} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold ${f.respondido ? "border border-slate-300 text-slate-700" : "bg-sea text-white"}`}>
              {f.respondido ? "Responder de novo" : "Responder"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
