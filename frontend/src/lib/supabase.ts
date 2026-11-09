import { createClient } from "@supabase/supabase-js";
import type { SubmitKind } from "@/lib/mapas";

// A URL e a chave "anon/public" NÃO são segredo (o navegador precisa delas); quem protege os dados são as
// regras do banco (supabase/setup.sql). A chave "service_role" nunca entra neste site.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xzapghpkyrxbyhbrlppi.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Ht4Nn35DbazdDsQ1TLOcAQ_RdOQuPRu";

export const SUPABASE_URL = URL;
export const supabaseConfigured = Boolean(URL && KEY);

// Valores de reserva só para o site abrir (e o build passar) antes de você configurar.
export const supabase = createClient(URL || "https://sem-configuracao.supabase.co", KEY || "sem-configuracao");

export const T = { perfis: "mc_perfis", cadastros: "mc_cadastros", publicados: "mc_publicados" } as const;

export type EntryStatus = "pending" | "approved" | "rejected";

/** Campos de um cadastro (iguais em `mc_cadastros.data` e `mc_publicados.data`). */
export type EntryData = {
  kind: SubmitKind;
  name: string;
  shortDescription: string;
  longDescription?: string | null;
  type?: string | null;
  areas: string[];
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  city?: string | null;
  place?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  site?: string | null;
  contact?: string | null;
  photos?: string[]; // links públicos no bucket mc-fotos
  videos?: string[]; // links do YouTube
};

export type Submission = EntryData & {
  id: string;
  createdAt: string;
  ownerId: string;
  ownerName?: string | null;
  status: EntryStatus;
  note?: string | null;
};

/** Só estes campos vão para a tabela pública (nada de dono, status ou nota interna). */
export const PUBLIC_FIELDS = [
  "kind", "name", "shortDescription", "longDescription", "type", "areas", "lat", "lng",
  "address", "city", "place", "startsAt", "endsAt", "site", "contact", "photos", "videos",
] as const;

export function publicData(s: EntryData & Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_FIELDS) out[k] = s[k] ?? (k === "areas" || k === "photos" || k === "videos" ? [] : null);
  return out;
}

function asObject(json: unknown): Record<string, any> {
  try {
    const v = typeof json === "string" ? JSON.parse(json) : json;
    return v && typeof v === "object" ? (v as Record<string, any>) : {};
  } catch {
    return {};
  }
}

/** Linha de `mc_cadastros` -> cadastro completo. */
export function rowToSubmission(row: any): Submission {
  const d = asObject(row.data);
  return {
    areas: [],
    ...d,
    kind: d.kind ?? "agent",
    name: d.name ?? "(sem nome)",
    shortDescription: d.shortDescription ?? "",
    id: row.id,
    createdAt: row.created_at,
    ownerId: row.owner_id,
    status: row.status,
    note: row.note ?? null,
  } as Submission;
}

/** Linha de `mc_publicados` -> cadastro público. */
export function rowToEntry(row: any): EntryData & { id: string } {
  return { areas: [], ...asObject(row.data), id: row.id } as EntryData & { id: string };
}

/** Mensagem em português para os erros do Supabase. */
export function errMsg(e: unknown): string {
  const x = e as { code?: string; status?: number; message?: string };
  const m = x?.message ?? "";
  if (!supabaseConfigured) return "O site ainda não está ligado ao Supabase (faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no Netlify).";
  if (/invalid login credentials/i.test(m)) return "E-mail ou senha inválidos.";
  if (/email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos e depois entre.";
  if (/already registered|already been registered/i.test(m)) return "Este e-mail já está cadastrado. Tente entrar.";
  if (/rate limit|too many/i.test(m) || x?.status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (/password/i.test(m) && /(least|weak|short)/i.test(m)) return "A senha deve ter pelo menos 8 caracteres.";
  if (x?.code === "42P01" || x?.code === "PGRST205" || /could not find the table|does not exist/i.test(m))
    return /mc_posts/.test(m) ? "O blog e o podcast ainda não foram criados no Supabase. Rode o arquivo supabase/blog.sql no SQL Editor."
      : /mc_formularios|mc_respostas|mc_form_publico/.test(m) ? "Os formulários de campo ainda não foram criados no Supabase. Rode o arquivo supabase/campo.sql no SQL Editor."
      : "Falta criar as tabelas no Supabase. Rode o arquivo supabase/setup.sql no SQL Editor.";
  if (x?.code === "42501" || /row-level security|permission denied/i.test(m)) return "Sem permissão para esta ação com a sua conta.";
  if (x?.code === "P0001") return m; // mensagens escritas em português nas funções do banco
  if (/failed to fetch|network|load failed/i.test(m)) return "Não foi possível falar com o servidor. Confira a conexão e a URL do Supabase.";
  return m || "Algo deu errado. Tente de novo.";
}
