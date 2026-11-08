"use client";

import { useState } from "react";
import { MAX_AUDIO_MB, uploadAudio, uploadPhoto } from "@/lib/media";
import { POST_KINDS, type Post, type PostKind } from "@/lib/posts";
import { errMsg, supabase } from "@/lib/supabase";
import { embedFor } from "@/lib/youtube";

const TABLE = "mc_posts";

type Props = {
  userId: string;
  userName: string;
  isAdmin: boolean;
  initial?: Post;
  onSaved: () => void;
  onCancel: () => void;
};

/** Novo texto do blog ou episódio de podcast. Administrador publica direto; agente envia para aprovação. */
export default function PostForm({ userId, userName, isAdmin, initial, onSaved, onCancel }: Props) {
  const [kind, setKind] = useState<PostKind>(initial?.kind ?? "blog");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [cover, setCover] = useState<string | null>(initial?.cover ?? null);
  const [audio, setAudio] = useState<string | null>(initial?.audio ?? null);
  const [embed, setEmbed] = useState(initial?.embed ?? "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<"" | "cover" | "audio">("");
  const [error, setError] = useState("");

  async function pickCover(f: File | undefined) {
    if (!f) return;
    setError("");
    setSending("cover");
    try {
      setCover(await uploadPhoto(userId, f));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending("");
    }
  }

  async function pickAudio(f: File | undefined) {
    if (!f) return;
    setError("");
    setSending("audio");
    try {
      setAudio(await uploadAudio(userId, f));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sending) return setError("Aguarde o envio do arquivo terminar.");
    if (embed.trim() && !embedFor(embed)) return setError("O link do player precisa ser do Spotify, do YouTube ou do SoundCloud.");
    if (kind === "podcast" && !audio && !embed.trim()) return setError("Envie o arquivo de áudio ou cole um link do Spotify, YouTube ou SoundCloud.");
    if (kind === "blog" && body.trim().length < 30) return setError("Escreva o texto (pelo menos algumas frases).");

    const row = {
      kind,
      title: title.trim(),
      summary: summary.trim() || null,
      body: body.trim() || null,
      cover,
      audio: kind === "podcast" ? audio : null,
      embed: kind === "podcast" ? embed.trim() || null : null,
    };

    setBusy(true);
    try {
      if (initial) {
        const extra = isAdmin ? {} : { status: "pending", note: null };
        const r = await supabase.from(TABLE).update({ ...row, ...extra }).eq("id", initial.id);
        if (r.error) throw r.error;
      } else {
        const extra = isAdmin ? { status: "published", published_at: new Date().toISOString() } : { status: "pending" };
        const r = await supabase.from(TABLE).insert({ ...row, ...extra, author_id: userId, author_name: userName });
        if (r.error) throw r.error;
      }
      onSaved();
    } catch (err) {
      setError(`Ao salvar: ${errMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-dark">{initial ? "Editar publicação" : "Nova publicação"}</h2>

      <div>
        <label>O que você quer publicar?
          <select value={kind} onChange={(e) => setKind(e.target.value as PostKind)} disabled={!!initial}>
            <option value="blog">Texto para o blog</option>
            <option value="podcast">Episódio de podcast (áudio)</option>
          </select>
        </label>
      </div>
      <div><label>Título<input required minLength={3} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></label></div>
      <div><label>Resumo (aparece na lista)<textarea rows={2} maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} /></label></div>
      <div>
        <label>{kind === "blog" ? "Texto" : "Sobre o episódio (opcional)"}
          <textarea rows={kind === "blog" ? 12 : 5} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <p className="mt-1 text-xs text-gray-500">Texto simples: deixe uma linha em branco entre os parágrafos.</p>
      </div>

      <div>
        <span className="text-sm font-medium text-gray-700">Imagem de capa (opcional)</span>
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="h-16 w-24 rounded-lg object-cover" />}
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-dashed border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {sending === "cover" ? "Enviando…" : cover ? "Trocar imagem" : "+ Escolher imagem"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!sending}
              onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {cover && <button type="button" onClick={() => setCover(null)} className="text-sm text-slate-500 underline">Remover</button>}
        </div>
      </div>

      {kind === "podcast" && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <div>
            <span className="text-sm font-medium text-gray-700">Arquivo de áudio (mp3, m4a, ogg ou wav, até {MAX_AUDIO_MB} MB)</span>
            <div className="mt-2 space-y-2">
              {audio && <audio controls src={audio} preload="none" className="w-full" />}
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-dashed border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {sending === "audio" ? "Enviando áudio… aguarde" : audio ? "Trocar áudio" : "+ Escolher áudio"}
                  <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.ogg,.wav" className="sr-only" disabled={!!sending}
                    onChange={(e) => { pickAudio(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {audio && <button type="button" onClick={() => setAudio(null)} className="text-sm text-slate-500 underline">Remover</button>}
              </div>
            </div>
          </div>
          <div>
            <label>Ou link do episódio (Spotify, YouTube ou SoundCloud)
              <input value={embed} onChange={(e) => setEmbed(e.target.value)} placeholder="https://open.spotify.com/episode/…" />
            </label>
            <p className="mt-1 text-xs text-gray-500">Se o episódio já está numa plataforma, basta o link: o player aparece aqui no site e o áudio continua lá.</p>
          </div>
        </div>
      )}

      {!isAdmin && <p className="text-xs text-gray-500">Depois de enviar, a equipe revisa antes de publicar. Você acompanha o status no seu painel.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || !!sending} className="rounded-full bg-sea px-6 py-2.5 font-semibold text-white disabled:opacity-50">
          {busy ? "Salvando…" : isAdmin ? "Publicar" : initial ? "Salvar e reenviar" : "Enviar para aprovação"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border px-6 py-2.5 text-gray-700">Cancelar</button>
      </div>
    </form>
  );
}
