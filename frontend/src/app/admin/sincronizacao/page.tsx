"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = {
  entity: string;
  local_id: number;
  remote_id: number | null;
  status: string;
  error: string | null;
  last_synced_at: string | null;
};

export default function SincronizacaoPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => api<Row[]>("/api/sync/status").then(setRows).catch(console.error);
  useEffect(() => { load(); }, []);

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      await api(`/api/sync/run?dry_run=${dryRun}`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Sincronização</h1>
      <div className="mt-4 flex gap-3">
        <button disabled={busy} onClick={() => run(true)}
          className="rounded border px-4 py-2 disabled:opacity-50">
          Simular (dry-run)
        </button>
        <button disabled={busy} onClick={() => run(false)}
          className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          Enviar agora
        </button>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Tipo</th><th>ID local</th><th>ID remoto</th><th>Status</th><th>Último envio</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.entity}-${r.local_id}`} className="border-t">
              <td>{r.entity}</td>
              <td>{r.local_id}</td>
              <td>{r.remote_id ?? "—"}</td>
              <td className={r.status === "error" ? "text-red-600" : ""} title={r.error ?? ""}>
                {r.status}
              </td>
              <td>{r.last_synced_at ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
