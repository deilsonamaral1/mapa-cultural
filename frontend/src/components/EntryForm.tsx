"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MAX_PHOTOS, MAX_VIDEOS, photoUrls, uploadPhoto, youtubeId } from "@/lib/media";
import { T, errMsg, publicData, supabase, type EntryData, type Submission } from "@/lib/supabase";
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
  prefill?: Partial<EntryData>; // começa o formulário com estes dados (ex.: vindos de uma resposta de campo)
  publishNow?: boolean; // equipe: salva já publicado no mapa
  onSaved: () => void;
  onCancel: () => void;
};

export default function EntryForm({ ownerId, ownerName, initial, prefill, publishNow, onSaved, onCancel }: Props) {
  const init: Partial<EntryData> | undefined = initial ?? prefill;
  const [kind, setKind] = useState<SubmitKind>(init?.kind ?? "agent");
  const [name, setName] = useState(init?.name ?? "");
  const [shortDescription, setShort] = useState(init?.shortDescription ?? "");
  const [longDescription, setLong] = useState(init?.longDescription ?? "");
  const [type, setType] = useState(init?.type ?? "");
  const [areas, setAreas] = useState<string[]>(init?.areas ?? []);
  const [lat, setLat] = useState<number | null>(init?.lat ?? null);
  const [lng, setLng] = useState<number | null>(init?.lng ?? null);
  const [address, setAddress] = useState(init?.address ?? "");
  const [city, setCity] = useState(init?.city ?? "Aquiraz");
  const [place, setPlace] = useState(init?.place ?? "");
  const [startsAt, setStartsAt] = useState(toInput(init?.startsAt));
  const [endsAt, setEndsAt] = useState(toInput(init?.endsAt));
  const [site, setSite] = useState(init?.site ?? "");
  const [contact, setContact] = useState(init?.contact ?? "");
  const [photos, setPhotos] = useState<string[]>(photoUrls(init?.photos));
  const [videos, setVideos] = useState<string[]>(init?.videos?.length ? init.videos.map((v) => `https://youtu.be/${v}`) : [""]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const added: string[] = [];
      for (const f of Array.from(files).slice(0, room)) added.push(await uploadPhoto(ownerId, f));
      setPhotos((cur) => [...cur, ...added]);
      if (files.length > room) setError(`Máximo de ${MAX_PHOTOS} fotos.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(false);
    }
  }

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

    const filled = videos.map((v) => v.trim()).filter(Boolean);
    const ids = filled.map((v) => youtubeId(v));
    if (ids.some((i) => !i)) return setError("Um dos links de vídeo não parece ser do YouTube. Cole o endereço do vídeo (youtube.com ou youtu.be).");
    if (uploading) return setError("Aguarde o envio das fotos terminar.");

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
      photos,
      videos: Array.from(new Set(ids as string[])),
    };

    setBusy(true);
    try {
      if (initial) {
        // editar devolve o cadastro para aprovação
        const r = await supabase.from(T.cadastros).update({ data: { ...data, ownerName }, status: "pending", note: null }).eq("id", initial.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from(T.cadastros).insert({ data: { ...data, ownerName }, owner_id: ownerId, status: "pending" }).select("id").single();
        if (r.error) throw r.error;
        if (publishNow) {
          const pub = await supabase.from(T.publicados).upsert({ id: r.data.id, kind: data.kind, data: publicData(data as never) });
          if (pub.error) throw pub.error;
          const ok = await supabase.from(T.cadastros).update({ status: "approved", note: null }).eq("id", r.data.id);
          if (ok.error) throw ok.error;
        }
      }
      onSaved();
    } catch (err) {
      setError(`Ao enviar o cadastro: ${errMsg(err)}`);
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

      <div>
        <span className="text-sm font-medium text-gray-700">Fotos (opcional, até {MAX_PHOTOS})</span>
        {photos.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((src) => (
              <li key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <button type="button" aria-label="Remover foto" onClick={() => setPhotos((c) => c.filter((x) => x !== src))}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white">×</button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="mt-2 inline-flex cursor-pointer items-center rounded-xl border border-dashed border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {uploading ? "Enviando foto…" : "+ Escolher fotos"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} className="sr-only"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <p className="mt-1 text-xs text-gray-500">As fotos ficam públicas depois da aprovação. Use fotos suas ou com autorização.</p>
      </div>

      <div>
        <span className="text-sm font-medium text-gray-700">Vídeos do YouTube (opcional, até {MAX_VIDEOS})</span>
        <div className="mt-2 space-y-2">
          {videos.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input value={v} onChange={(e) => setVideos((c) => c.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://www.youtube.com/watch?v=…" aria-label={`Link do vídeo ${i + 1}`} />
              {videos.length > 1 && (
                <button type="button" aria-label="Remover vídeo" onClick={() => setVideos((c) => c.filter((_, j) => j !== i))} className="shrink-0 rounded-xl border px-3 text-slate-600">×</button>
              )}
            </div>
          ))}
        </div>
        {videos.length < MAX_VIDEOS && (
          <button type="button" onClick={() => setVideos((c) => [...c, ""])} className="mt-2 text-sm font-medium text-brand underline">+ Adicionar outro vídeo</button>
        )}
        <p className="mt-1 text-xs text-gray-500">O vídeo continua no YouTube; o site só mostra o player. Dica: no YouTube, deixe o vídeo como "Público" ou "Não listado".</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label>Site ou rede social (opcional)<input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" /></label></div>
        <div><label>Contato público (opcional)<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="E-mail ou telefone" /></label></div>
      </div>
      <p className="text-xs text-gray-500">Atenção: o contato, o endereço e o local marcado serão públicos depois da aprovação.</p>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-full bg-sea px-6 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Enviando…" : initial ? "Salvar e reenviar" : publishNow ? "Criar e publicar" : "Enviar para aprovação"}</button>
        <button type="button" onClick={onCancel} className="rounded-full border px-6 py-2.5 text-gray-700">Cancelar</button>
      </div>
    </form>
  );
}
