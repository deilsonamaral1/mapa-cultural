"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Item = { id: number; name: string; short_description?: string | null; owner_email?: string | null; agent_id?: number };
type Pending = { agents: Item[]; spaces: Item[]; events: Item[] };

const SECTIONS: { key: keyof Pending; label: string }[] = [
  { key: "agents", label: "Agentes" },
  { key: "spaces", label: "Espaços" },
  { key: "events", label: "Eventos" },
];

export default function ModeracaoPage() {
  const [data, setData] = useState<Pending | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () => api<Pending>("/api/moderation/pending").then(setData).catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => { load(); }, [load]);

  async function decide(kind: string, id: number, action: "approve" | "reject") {
    setError("");
    try {
      await api(`/api/moderation/${kind}/${id}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  const total = data ? data.agents.length + data.spaces.length + data.events.length : 0;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Moderação</h1>
      <p className="mt-1 text-sm text-gray-600">
        Só o que for aprovado aparece no mapa e entra na sincronização. Aprove o agente antes dos espaços e eventos dele.
      </p>
      {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {data && total === 0 && <p className="mt-6 text-gray-500">Nada pendente. 🎉</p>}

      {data && SECTIONS.map((s) => data[s.key].length > 0 && (
        <section key={s.key} className="mt-6">
          <h2 className="font-medium">{s.label} ({data[s.key].length})</h2>
          <ul className="mt-2 divide-y rounded border">
            {data[s.key].map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4 p-3">
                <div>
                  <div className="font-medium">{it.name}</div>
                  {it.owner_email && <div className="text-sm text-gray-500">{it.owner_email}</div>}
                  {it.short_description && <p className="text-sm text-gray-600">{it.short_description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => decide(s.key, it.id, "approve")} className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">Aprovar</button>
                  <button onClick={() => decide(s.key, it.id, "reject")} className="rounded border px-3 py-1 text-sm text-red-600">Rejeitar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
