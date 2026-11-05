"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "ref" | "datetime" | "checkbox";
  options?: { value: number | string; label: string }[];
  refEndpoint?: string; // para type "ref": carrega opções de /api/agents etc.
  meta?: boolean;        // grava dentro de `meta` (agent_meta / space_meta)
  required?: boolean;
};

type Row = Record<string, any>;

const STATUS_LABEL: Record<number, string> = { 1: "Publicado", 0: "Pendente de aprovação" };

export default function EntityCrud({
  title, endpoint, fields, columns, initial,
}: {
  title: string;
  endpoint: string;
  fields: Field[];
  columns: { key: string; label: string }[];
  initial: Row;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row | null>(null);
  const [refs, setRefs] = useState<Record<string, { id: number; name: string }[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api<Row[]>(endpoint).then(setRows).catch((e) => setError(e.message)),
    [endpoint],
  );

  useEffect(() => {
    load();
    fields.filter((f) => f.type === "ref" && f.refEndpoint).forEach((f) =>
      api<{ id: number; name: string }[]>(f.refEndpoint!)
        .then((d) => setRefs((r) => ({ ...r, [f.name]: d })))
        .catch(() => {}),
    );
  }, [load, fields]);

  const get = (f: Field) => (f.meta ? form?.meta?.[f.name] : form?.[f.name]) ?? "";
  const set = (f: Field, v: any) =>
    setForm((cur) => cur && (f.meta ? { ...cur, meta: { ...cur.meta, [f.name]: v } } : { ...cur, [f.name]: v }));

  function normalize(f: Field, raw: any) {
    if (raw === "" || raw === undefined) return null;
    if (f.type === "number") return Number(raw);
    if (f.type === "ref") return Number(raw);
    return raw;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const payload: Row = { ...form, meta: { ...(form.meta ?? {}) } };
      for (const f of fields) {
        if (f.meta) payload.meta[f.name] = payload.meta[f.name] || null;
        else if (f.type !== "checkbox" && f.type !== "text" && f.type !== "textarea" && f.type !== "select")
          payload[f.name] = normalize(f, payload[f.name]);
        else if (f.type === "text" || f.type === "textarea") payload[f.name] = payload[f.name] || null;
      }
      if (form.id) await api(`${endpoint}/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Enviar "${row.name}" para a lixeira?`)) return;
    try {
      await api(`${endpoint}/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <button onClick={() => setForm({ ...initial, meta: {} })} className="rounded bg-brand px-4 py-2 text-sm text-white">
          Novo
        </button>
      </div>
      {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <table className="mt-5 w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>{columns.map((c) => <th key={c.key} className="pb-2">{c.label}</th>)}<th className="pb-2">Situação</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {columns.map((c) => <td key={c.key} className="py-2 pr-3">{String(r[c.key] ?? "—")}</td>)}
              <td className={`py-2 pr-3 ${r.status === 1 ? "text-emerald-700" : "text-amber-700"}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </td>
              <td className="space-x-3 text-right">
                <button className="text-brand-dark underline" onClick={() => setForm({ ...r, meta: r.meta ?? {} })}>Editar</button>
                <button className="text-red-600 underline" onClick={() => remove(r)}>Excluir</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="py-6 text-gray-500" colSpan={columns.length + 2}>Nenhum registro.</td></tr>}
        </tbody>
      </table>

      {form && (
        <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/40 p-4">
          <form onSubmit={save} className="my-8 w-full max-w-xl space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{form.id ? "Editar" : "Novo"} · {title}</h2>
            {fields.map((f) => (
              <div key={`${f.meta ? "m-" : ""}${f.name}`}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!form[f.name]} onChange={(e) => set(f, e.target.checked)} />
                    {f.label}
                  </label>
                ) : (
                  <label>
                    {f.label}
                    {f.type === "textarea" ? (
                      <textarea rows={3} value={get(f)} required={f.required} onChange={(e) => set(f, e.target.value)} />
                    ) : f.type === "select" ? (
                      <select value={get(f)} onChange={(e) => set(f, Number(e.target.value))}>
                        {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "ref" ? (
                      <select value={get(f)} required={f.required} onChange={(e) => set(f, e.target.value)}>
                        <option value="">Selecione…</option>
                        {(refs[f.name] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    ) : f.type === "datetime" ? (
                      <input type="datetime-local" value={String(get(f)).slice(0, 16)} onChange={(e) => set(f, e.target.value)} />
                    ) : (
                      <input type={f.type === "number" ? "number" : "text"} step="any" value={get(f)}
                        required={f.required} onChange={(e) => set(f, e.target.value)} />
                    )}
                  </label>
                )}
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="rounded border px-4 py-2 text-sm">Cancelar</button>
              <button disabled={busy} className="rounded bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
