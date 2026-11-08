import { shrink } from "@/lib/media";
import { supabase } from "@/lib/supabase";

export type PerguntaTipo = "texto" | "longo" | "escolha" | "midia";

export type Pergunta = {
  id: string;
  texto: string;
  tipo: PerguntaTipo;
  opcoes?: string[]; // só "escolha"
  obrigatoria?: boolean;
};

export type Formulario = {
  id: string;
  titulo: string;
  descricao: string | null;
  perguntas: Pergunta[];
  aberto?: boolean;
  created_at?: string;
};

/** Anexo guardado na resposta (o arquivo fica num espaço privado; só o administrador vê). */
export type Anexo = { path: string; name: string; type: string };

export type Resposta = {
  id: string;
  form_id: string;
  respondente: string | null;
  contato: string | null;
  respostas: Record<string, string | Anexo[]>;
  created_at: string;
};

export const TIPOS: Record<PerguntaTipo, string> = {
  texto: "Resposta curta",
  longo: "Resposta longa",
  escolha: "Escolher uma opção",
  midia: "Anexos (fotos, áudio, vídeo)",
};

export const CAMPO_BUCKET = "mc-campo";
export const MAX_ANEXO_MB = 50;
export const MAX_ANEXOS = 12;

export const campoLink = (id: string) => `${window.location.origin}/campo?f=${id}`;

/** Garante perguntas bem formadas (o JSON vem do banco). */
export function cleanPerguntas(v: unknown): Pergunta[] {
  if (!Array.isArray(v)) return [];
  const out: Pergunta[] = [];
  for (const q of v) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const tipo = (["texto", "longo", "escolha", "midia"] as const).find((t) => t === o.tipo) ?? "texto";
    if (typeof o.id !== "string" || typeof o.texto !== "string") continue;
    out.push({
      id: o.id,
      texto: o.texto,
      tipo,
      opcoes: Array.isArray(o.opcoes) ? o.opcoes.filter((x): x is string => typeof x === "string") : undefined,
      obrigatoria: o.obrigatoria === true,
    });
  }
  return out;
}

/** Envia um anexo para a pasta do formulário. Fotos são reduzidas no aparelho para economizar dados. */
export async function uploadAnexo(formId: string, respId: string, file: File): Promise<Anexo> {
  const isImage = file.type.startsWith("image/");
  const isMedia = isImage || file.type.startsWith("audio/") || file.type.startsWith("video/");
  if (!isMedia) throw new Error("Tipo de arquivo não aceito. Envie foto, áudio ou vídeo.");

  let body: Blob = file;
  let type = file.type;
  let ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  if (isImage) {
    try {
      body = await shrink(file);
      type = "image/jpeg";
      ext = "jpg";
    } catch {
      throw new Error("Não consegui abrir esta foto. Use uma imagem JPG ou PNG.");
    }
  }
  if (body.size > MAX_ANEXO_MB * 1024 * 1024)
    throw new Error(`"${file.name}" tem mais de ${MAX_ANEXO_MB} MB. Comprima o arquivo ou envie um trecho menor.`);

  const path = `${formId}/${respId}/${crypto.randomUUID()}.${ext}`;
  const r = await supabase.storage.from(CAMPO_BUCKET).upload(path, body, { contentType: type, cacheControl: "3600" });
  if (r.error) throw r.error;
  return { path, name: file.name, type };
}

/** Links temporários (1 hora) para o administrador ver os anexos privados. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const r = await supabase.storage.from(CAMPO_BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const x of r.data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}
