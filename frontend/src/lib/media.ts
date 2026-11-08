import { SUPABASE_URL, supabase } from "@/lib/supabase";
import { youtubeId } from "@/lib/youtube";

export { youtubeId };
export { embedFor } from "@/lib/youtube";

export const BUCKET = "mc-fotos";
export const MAX_PHOTOS = 4;
export const MAX_VIDEOS = 3;

const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

/** Só aceita fotos que estão no nosso bucket (o texto vem de agentes: nunca confie em link qualquer). */
export function photoUrls(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.startsWith(PUBLIC_PREFIX)).slice(0, MAX_PHOTOS) : [];
}

/** Lista de links ou códigos -> só códigos válidos. */
export function youtubeIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const id = typeof x === "string" ? youtubeId(x) : null;
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_VIDEOS);
}

/** Reduz a foto no próprio navegador (lado maior 1600 px, JPEG) para economizar espaço e dados. */
export async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Não consegui processar a foto."))), "image/jpeg", 0.82));
}

/** Envia a foto para a pasta da própria conta e devolve o link público. */
export async function uploadPhoto(ownerId: string, file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch {
    throw new Error("Não consegui abrir esta foto. Use uma imagem JPG ou PNG.");
  }
  const path = `${ownerId}/${crypto.randomUUID()}.jpg`;
  const r = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (r.error) throw r.error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export const AUDIO_BUCKET = "mc-audio";
export const MAX_AUDIO_MB = 50;
const AUDIO_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/`;

/** Só aceita áudio que está no nosso espaço de arquivos. */
export const audioUrl = (v: unknown): string | null => (typeof v === "string" && v.startsWith(AUDIO_PREFIX) ? v : null);
export const coverUrl = (v: unknown): string | null => (typeof v === "string" && v.startsWith(PUBLIC_PREFIX) ? v : null);

/** Envia um áudio (mp3, m4a, ogg, wav) para a pasta da própria conta e devolve o link público. */
export async function uploadAudio(ownerId: string, file: File): Promise<string> {
  if (file.size > MAX_AUDIO_MB * 1024 * 1024) throw new Error(`O áudio tem mais de ${MAX_AUDIO_MB} MB. Comprima o arquivo (mp3 de 128 kbps rende cerca de 1 MB por minuto) ou use um link do Spotify ou YouTube.`);
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp3";
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const r = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, { contentType: file.type || "audio/mpeg", cacheControl: "31536000" });
  if (r.error) throw r.error;
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}
