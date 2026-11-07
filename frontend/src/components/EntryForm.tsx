"use client";

import { Permission, Role } from "appwrite";
import dynamic from "next/dynamic";
import { useState } from "react";
import { APPWRITE, ID, databases, errMsg, type EntryData, type Submission } from "@/lib/appwrite";
import { KINDS, SUBMIT_KINDS, type SubmitKind } from "@/lib/mapas";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded border text-sm text-gray-500">Carregando mapa…</div>,
});

const AREAS = ["Artes visuais", "Artesanato", "Audiovisual", "Circo", "Cultura popular", "Dança", "Literatura", "Música", "Patrimônio cultural", "Teatro"];
const TYPES: Record<SubmitKind, string[]> = {
  agent: ["Individual", "Coletivo"],
  space: ["Teatro", "Museu", "Biblioteca", "Casa de cultura", "Ponto de cultura", "Centro cultural", "Praça"],
  event: ["Show", "Oficina", "Exposição", "Espetáculo", "Festa popular", "Feira", "Palestra"],
};

// "2026-11-08T19:00" (hora local do campo) <-> ISO
const toInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
const orNull = (v: string) => (v.trim() ? v.trim() : null);

type Props = {
  ownerId: string;
  ownerName: string;
  initial?: Submission;
  onSaved: () => void;
  onCancel: () => void;
};

export default function EntryForm({ ownerId, ownerName, initial, onSaved, onCancel }: Props) {
  const [kind, setKind] = useState<SubmitKind>(initial?.kind ?? "agent");
  const [name, setName] = useState(initial?.name ?? "");
  const [shortDescription, setShort] = useState(initial?.shortDescription ?? "");
  const [longDescription, setLong] = useState(initial?.longDescription ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [areas, setAreas] = useState<string[]>(initial?.areas ?? []);
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "Aquiraz");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [startsAt, setStartsAt] = useState(toInput(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toInput(initial?.endsAt));
  const [site, setSite] = useState(initial?.site ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleArea = (a: string) => setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  function locate() {
    if (!navigator.geolocation) return setError("Seu navegador não permite localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
      },
      () => setError("Não consegui sua localização. Clique no mapa para marcar o local."),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (lat == null || lng == null) return setError("Marque o local no mapa (clique no ponto certo).");
    if (kind === "event" && !startsAt) return setError("Informe a data e a hora de início do evento.");
    if (kind === "event" && endsAt && new Date(endsAt) < new Date(startsAt)) return setError("O fim do evento não pode ser antes do início.");

    const data: EntryData = {
      kind,
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      longDescription: orNull(longDescription),
      type: orNull(type),
      areas,
      lat,
      lng,
      address: orNull(address),
      city: orNull(city),
      place: kind === "event" ? orNull(place) : null,
      startsAt: kind === "event" ? toIso(startsAt) : null,
      endsAt: kind === "event" ? toIso(endsAt) : null,
      site: orNull(site),
      contact: orNull(contact),
    };

    setBusy(true);
    try {
      if (initial) {
        // editar devolve o cadastro para aprovação
        await databases.updateDocument(APPWRITE.database, APPWRITE.submissions, initial.$id, { ...data, status: "pending", note: null });
      } else {
        await databases.createDocument(
          APPWRITE.database,
          APPWRITE.submissions,
          ID.unique(),
          { ...data, ownerId, ownerName, status: "pending" },
          [Permission.read(Role.user(ownerId)), Permission.update(Role.user(ownerId)), Permission.delete(Role.user(ownerId))],
        );
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-dark">{initial ? "Editar cadastro" : "Novo cadastro"}</h2>

      <div>
        <label>O que você quer cadastrar?
          <select value={kind} onChange={(e) => { setKind(e.target.value as SubmitKind); setType(""); }} disabled={!!initial}>
            {SUBMIT_KINDS.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select>
        </label>
      </div>

      <div><label>Nome<input required minLength={2} maxLength={255} value={name} onChange={(e) => setName(e.target.value)} /></label></div>

      <div>
        <label>Descrição curta <span className="font-normal text-gray-500">({shortDescription.length}/400)</span>
          <textarea required maxLength={400} rows={3} value={shortDescription} onChange={(e) => setShort(e.target.value)} />
        </label>
      </div>

      <div><label>Descrição completa (opcional)<textarea maxLength={5000} rows={4} value={longDescription} onChange={(e) => setLong(e.target.value)} /></label></div>

      <div>
        <label>Tipo
          <input list={`types-${kind}`} value={type} onChange={(e) => setType(e.target.value)} placeholder="Escolha ou digite" />
        </label>
        <datalist id={`types-${kind}`}>{TYPES[kind].map((t) => <option key={t} value={t} />)}</datalist>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Áreas de atuação</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {AREAS.map((a) => (
            <button type="button" key={a} onClick={() => toggleArea(a)} aria-pressed={areas.includes(a)}
              className={`rounded-full border px-3 py-1 text-xs ${areas.includes(a) ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-700"}`}>
              {a}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === "event" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label>Início<input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label></div>
          <div><label>Fim (opcional)<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label></div>
          <div className="sm:col-span-2"><label>Nome do local<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ex.: Teatro Municipal" /></label></div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label>Endereço<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" /></label></div>
        <div><label>Cidade<input value={city} onChange={(e) => setCity(e.target.value)} /></label></div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Local no mapa (clique para marcar)</span>
          <button type="button" onClick={locate} className="text-xs font-medium text-blue-700 underline">📍 Usar minha localização</button>
        </div>
        <LocationPicker lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
        <p className="mt-1 text-xs text-gray-500">{lat != null && lng != null ? `Marcado: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Nenhum ponto marcado ainda."}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label>Site ou rede social (opcional)<input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" /></label></div>
        <div><label>Contato público (opcional)<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="E-mail ou telefone" /></label></div>
      </div>
      <p className="text-xs text-gray-500">Atenção: o contato, o endereço e o local marcado serão públicos depois da aprovação.</p>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded bg-brand px-5 py-2 font-medium text-white disabled:opacity-50">{busy ? "Enviando…" : initial ? "Salvar e reenviar" : "Enviar para aprovação"}</button>
        <button type="button" onClick={onCancel} className="rounded border px-5 py-2 text-gray-700">Cancelar</button>
      </div>
    </form>
  );
}
