import { SUPABASE_URL, supabase } from "@/lib/supabase";

export const BUCKET = "mc-fotos";
export const MAX_PHOTOS = 4;
export const MAX_VIDEOS = 3;

const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

/** Só aceita fotos que estão no nosso bucket (o texto vem de agentes: nunca confie em link qualquer). */
export function photoUrls(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.startsWith(PUBLIC_PREFIX)).slice(0, MAX_PHOTOS) : [];
}

/** Extrai o código de 11 caracteres de um link do YouTube (watch, youtu.be, shorts, embed, live). */
export function youtubeId(url: string): string | null {
  const s = url.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
        id = m ? m[1] : null;
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
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
async function shrink(file: File): Promise<Blob> {
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
