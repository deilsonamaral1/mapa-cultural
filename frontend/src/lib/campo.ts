import { shrink } from "@/lib/media";
import { supabase } from "@/lib/supabase";

export type PerguntaTipo = "texto" | "longo" | "escolha" | "escala" | "data" | "midia";

export type Pergunta = {
  id: string;
  texto: string;
  tipo: PerguntaTipo;
  opcoes?: string[]; // só "escolha"
  obrigatoria?: boolean;
  condicao?: { id: string; igual: string }; // só aparece se a resposta da pergunta `id` for `igual`
};

export type Formulario = {
  id: string;
  titulo: string;
  descricao: string | null;
  perguntas: Pergunta[];
  aberto?: boolean;
  publico?: boolean; // aparece na lista pública de formulários do site
  created_at?: string;
};

/** Anexo guardado na resposta. Arquivo: fica num espaço privado (só o administrador vê). Link: type "link", path = endereço. */
export type Anexo = { path: string; name: string; type: string };

/** Resposta de uma pergunta: texto e anexos (foto, áudio, vídeo, links) podem vir juntos, em qualquer tipo de pergunta. */
export type RespostaItem = { texto?: string; anexos?: Anexo[] };

export type Resposta = {
  id: string;
  form_id: string;
  respondente: string | null;
  contato: string | null;
  respostas: Record<string, unknown>;
  envio_id?: string | null;
  created_at: string;
};

export const TIPOS: Record<PerguntaTipo, string> = {
  texto: "Resposta curta",
  longo: "Resposta longa",
  escolha: "Escolher uma opção",
  escala: "Nota de 1 a 5",
  data: "Data",
  midia: "Só anexos (foto, áudio, vídeo)",
};

export const CAMPO_BUCKET = "mc-campo";
export const MAX_ANEXO_MB = 50;

export const campoLink = (id: string) => `${window.location.origin}/campo?f=${id}`;

/** Garante perguntas bem formadas (o JSON vem do banco). */
export function cleanPerguntas(v: unknown): Pergunta[] {
  if (!Array.isArray(v)) return [];
  const out: Pergunta[] = [];
  for (const q of v) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const tipo = (["texto", "longo", "escolha", "escala", "data", "midia"] as const).find((t) => t === o.tipo) ?? "texto";
    const c = o.condicao as { id?: unknown; igual?: unknown } | undefined;
    if (typeof o.id !== "string" || typeof o.texto !== "string") continue;
    out.push({
      id: o.id,
      texto: o.texto,
      tipo,
      opcoes: Array.isArray(o.opcoes) ? o.opcoes.filter((x): x is string => typeof x === "string") : undefined,
      obrigatoria: o.obrigatoria === true,
      condicao: c && typeof c.id === "string" && typeof c.igual === "string" ? { id: c.id, igual: c.igual } : undefined,
    });
  }
  return out;
}

/** Envia um anexo para a pasta do formulário. Fotos são reduzidas no aparelho para economizar dados. */
/** Confere tipo e tamanho ANTES de enviar (erro aqui não é falha de internet: não vai para a fila). */
export function validarAnexo(file: File) {
  const ok = file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("video/");
  if (!ok) throw new Error("Tipo de arquivo não aceito. Envie foto, áudio ou vídeo.");
  if (!file.type.startsWith("image/") && file.size > MAX_ANEXO_MB * 1024 * 1024)
    throw new Error(`"${file.name}" tem mais de ${MAX_ANEXO_MB} MB. Comprima o arquivo, grave um trecho menor ou envie para o YouTube/Drive e cole o link.`);
}

export async function uploadAnexo(formId: string, respId: string, file: File): Promise<Anexo> {
  validarAnexo(file);
  const isImage = file.type.startsWith("image/");

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

/** Lê uma resposta no formato novo ({texto, anexos}) ou nos formatos antigos (texto puro ou lista de anexos). */
export function normResp(v: unknown): RespostaItem {
  if (typeof v === "string") return { texto: v };
  if (Array.isArray(v)) return { anexos: v as Anexo[] };
  if (v && typeof v === "object") {
    const o = v as RespostaItem;
    return { texto: typeof o.texto === "string" ? o.texto : undefined, anexos: Array.isArray(o.anexos) ? o.anexos : undefined };
  }
  return {};
}

/** Link colado pelo agente (YouTube, Drive, WhatsApp...). Só aceita http(s). */
export function linkAnexo(raw: string): Anexo | null {
  const s = raw.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return { path: u.toString(), name: u.hostname.replace(/^www\./, ""), type: "link" };
  } catch {
    return null;
  }
}

const qid = () => crypto.randomUUID().slice(0, 8);

/** Modelos prontos para começar um formulário (os ids das perguntas são gerados na hora). */
export const MODELOS: { nome: string; titulo: string; descricao: string; perguntas: () => Pergunta[] }[] = [
  {
    nome: "Mestre ou mestra da cultura popular",
    titulo: "Mapeamento de mestre ou mestra da cultura popular",
    descricao: "Converse com a pessoa, anote com as palavras dela e registre fotos, áudio ou vídeo do relato.",
    perguntas: () => [
      { id: qid(), texto: "Nome completo e como a pessoa é conhecida", tipo: "texto", obrigatoria: true },
      { id: qid(), texto: "Qual é a sua arte ou saber (ex.: reisado, renda de bilro, coco)?", tipo: "texto", obrigatoria: true },
      { id: qid(), texto: "Há quantos anos pratica? Como aprendeu?", tipo: "longo" },
      { id: qid(), texto: "Conte a sua história (grave um áudio, se preferir)", tipo: "longo" },
      { id: qid(), texto: "Ensina ou passa o saber para outras pessoas?", tipo: "escolha", opcoes: ["Sim", "Não"] },
      { id: qid(), texto: "Onde ensina e para quem?", tipo: "longo" },
      { id: qid(), texto: "Endereço ou ponto de referência", tipo: "texto" },
      { id: qid(), texto: "Fotos do mestre, da prática e do lugar", tipo: "midia" },
    ],
  },
  {
    nome: "Visita a espaço cultural",
    titulo: "Visita a espaço cultural",
    descricao: "Preencha durante a visita ao espaço.",
    perguntas: () => [
      { id: qid(), texto: "Nome do espaço", tipo: "texto", obrigatoria: true },
      { id: qid(), texto: "Que tipo de espaço é?", tipo: "escolha", opcoes: ["Teatro", "Museu", "Biblioteca", "Casa de cultura", "Ponto de cultura", "Praça ou espaço aberto", "Outro"] },
      { id: qid(), texto: "Endereço e ponto de referência", tipo: "texto", obrigatoria: true },
      { id: qid(), texto: "Dias e horários de funcionamento", tipo: "texto" },
      { id: qid(), texto: "Que atividades acontecem aqui?", tipo: "longo" },
      { id: qid(), texto: "Tem acessibilidade (rampa, banheiro adaptado)?", tipo: "escolha", opcoes: ["Sim", "Em parte", "Não"] },
      { id: qid(), texto: "Nota para o estado de conservação", tipo: "escala" },
      { id: qid(), texto: "Fotos e vídeo do espaço", tipo: "midia" },
    ],
  },
  {
    nome: "Registro de evento",
    titulo: "Registro de evento cultural",
    descricao: "Registre o evento enquanto acontece.",
    perguntas: () => [
      { id: qid(), texto: "Nome do evento", tipo: "texto", obrigatoria: true },
      { id: qid(), texto: "Data do evento", tipo: "data", obrigatoria: true },
      { id: qid(), texto: "Local", tipo: "texto" },
      { id: qid(), texto: "Quem organizou?", tipo: "texto" },
      { id: qid(), texto: "Como foi? Descreva o que viu e ouviu", tipo: "longo" },
      { id: qid(), texto: "Nota para a participação do público", tipo: "escala" },
      { id: qid(), texto: "Fotos, vídeos ou áudio do evento", tipo: "midia" },
    ],
  },
];

/** A pergunta está visível? (sem condição, sempre; com condição, só se a resposta combinar) */
export const visivel = (q: Pergunta, vals: Record<string, string>) => !q.condicao || (vals[q.condicao.id] ?? "") === q.condicao.igual;

export const ehErroDeRede = (e: unknown) =>
  (typeof navigator !== "undefined" && !navigator.onLine) || e instanceof TypeError || /failed to fetch|network|load failed|fetch/i.test((e as Error)?.message ?? "");

export type Equipe = { id: string; nome: string; descricao: string | null };
export type Membro = { id: string; equipe_id: string; nome: string; telefone: string | null; email: string | null };
export type Envio = { id: string; form_id: string; membro_id: string };

/** Link pessoal de um agente (abre o formulário já com o nome dele e liga a resposta a ele). */
export const linkEnvio = (envioId: string) => `${window.location.origin}/campo?e=${envioId}`;

/** WhatsApp com a mensagem pronta. Aceita telefone com ou sem DDD/55; sem telefone, abre o WhatsApp para escolher o contato. */
export function waLink(telefone: string | null | undefined, texto: string) {
  let n = (telefone ?? "").replace(/\D/g, "");
  if (n && n.length <= 11) n = `55${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
