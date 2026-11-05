"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Item } from "@/components/MapView";

// Leaflet usa `window`: só carrega no navegador
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-gray-500">Carregando mapa…</div>,
});

const TABS = [
  { key: "agent", label: "Agentes" },
  { key: "space", label: "Espaços" },
  { key: "event", label: "Eventos" },
] as const;

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Nossa Cidade";

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("event");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api<Item[]>(`/api/public/search?type=${tab}&q=${encodeURIComponent(q)}`)
        .then((d) => { setItems(d); setError(""); })
        .catch(() => setError("Não foi possível carregar os dados."));
    }, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [tab, q]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between bg-brand px-5 py-3 text-white">
        <h1 className="text-lg font-semibold">Mapa Cultural · {city}</h1>
        <Link href="/admin" className="text-sm underline-offset-2 hover:underline">Área do cadastro</Link>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[380px_1fr]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="space-y-3 p-4">
            <div className="flex gap-1 rounded bg-brand-soft p-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 rounded px-3 py-1.5 text-sm ${tab === t.key ? "bg-brand text-white" : "text-brand-dark"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <input placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <ul className="flex-1 divide-y overflow-y-auto">
            {error && <li className="p-4 text-sm text-red-600">{error}</li>}
            {!error && items.length === 0 && <li className="p-4 text-sm text-gray-500">Nada encontrado.</li>}
            {items.map((it) => (
              <li key={`${tab}-${it.id}`} className="p-4">
                <div className="font-medium">{it.name}</div>
                {it.place && <div className="text-sm text-gray-600">{it.place}</div>}
                {it.starts_at && (
                  <div className="text-sm text-brand-dark">{new Date(it.starts_at).toLocaleString("pt-BR")}</div>
                )}
                {it.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{it.description}</p>}
              </li>
            ))}
          </ul>
        </aside>

        <main className="relative min-h-[300px]">
          <MapView items={items} />
        </main>
      </div>
    </div>
  );
}
