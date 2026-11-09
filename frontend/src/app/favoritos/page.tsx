"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useFavoritos } from "@/lib/favoritos";

export default function FavoritosPage() {
  const { list, toggle } = useFavoritos();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Salvos</h1>
        <p className="mt-1 text-sm text-slate-600">Ficam guardados só neste aparelho. Toque em “Salvar” em qualquer página para juntar aqui.</p>
        {list.length === 0 && <p className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-center text-slate-600">Você ainda não salvou nada.</p>}
        <ul className="mt-5 space-y-2">
          {list.map((f) => (
            <li key={f.href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <Link href={f.href} className="min-w-0 flex-1 font-semibold hover:text-brand">{f.name}</Link>
              <button onClick={() => toggle(f)} className="shrink-0 text-sm text-slate-500 underline">Remover</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
