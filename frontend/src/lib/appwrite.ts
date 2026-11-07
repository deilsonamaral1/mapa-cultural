import { Account, Client, Databases, ID, Query } from "appwrite";
import type { SubmitKind } from "@/lib/mapas";

// Endereço e IDs do projeto NÃO são segredo (o navegador precisa deles). A chave de API, sim:
// ela nunca entra neste site (só no script appwrite/setup.mjs, rodado no seu computador).
export const APPWRITE = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://nyc.cloud.appwrite.io/v1",
  project: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6aed2b790023e763ceff",
  database: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6aed2d2f003472943abd",
  // IDs das tabelas. Se no Appwrite elas tiverem outro ID (veja em Settings da tabela), troque aqui
  // ou use as variáveis NEXT_PUBLIC_APPWRITE_SUBMISSIONS_ID e NEXT_PUBLIC_APPWRITE_PUBLISHED_ID.
  submissions: process.env.NEXT_PUBLIC_APPWRITE_SUBMISSIONS_ID ?? "6aee7a4c003711ecb624", // o que os agentes enviam
  published: process.env.NEXT_PUBLIC_APPWRITE_PUBLISHED_ID ?? "6aee7a5b0029675dc1e6", // o que o público vê (só o admin grava)
};

const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.project);
export const account = new Account(client);
export const databases = new Databases(client);
export { ID, Query };

export type EntryStatus = "pending" | "approved" | "rejected";

/** Campos de um cadastro (iguais em `submissions` e `published`). */
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
};

export type Submission = EntryData & {
  $id: string;
  $createdAt: string;
  ownerId: string;
  ownerName?: string | null;
  status: EntryStatus;
  note?: string | null;
};

/** Só estes campos vão para a coleção pública (nada de dono, status ou nota interna). */
export const PUBLIC_FIELDS = [
  "kind", "name", "shortDescription", "longDescription", "type", "areas", "lat", "lng",
  "address", "city", "place", "startsAt", "endsAt", "site", "contact",
] as const;

export function publicData(s: EntryData & Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_FIELDS) out[k] = s[k] ?? (k === "areas" ? [] : null);
  return out;
}

/*
 * Como os dados ficam no Appwrite (poucas colunas, fáceis de criar à mão no painel):
 *   submissions: ownerId, status, note + data (JSON com todos os campos do cadastro)
 *   published:   kind + data (JSON com os campos públicos)
 */
function parseJson(json: unknown): Record<string, any> {
  try {
    const v = typeof json === "string" ? JSON.parse(json) : json;
    return v && typeof v === "object" ? (v as Record<string, any>) : {};
  } catch {
    return {};
  }
}

export const packEntry = (e: object) => JSON.stringify(e);

/** Linha da tabela `submissions` -> cadastro completo. */
export function rowToSubmission(row: any): Submission {
  const d = parseJson(row.data);
  return {
    areas: [],
    ...d,
    kind: d.kind ?? "agent",
    name: d.name ?? "(sem nome)",
    shortDescription: d.shortDescription ?? "",
    $id: row.$id,
    $createdAt: row.$createdAt,
    ownerId: row.ownerId,
    status: row.status,
    note: row.note ?? null,
  } as Submission;
}

/** Linha da tabela `published` -> cadastro público. */
export function rowToEntry(row: any): EntryData & { $id: string } {
  return { areas: [], ...parseJson(row.data), $id: row.$id } as EntryData & { $id: string };
}

/** Mensagem em português para os erros do Appwrite. */
export function errMsg(e: unknown): string {
  const x = e as { code?: number; type?: string; message?: string };
  const m = x?.message ?? "";
  if (x?.type === "user_already_exists") return "Este e-mail já está cadastrado. Tente entrar.";
  if (x?.type === "user_invalid_credentials") return "E-mail ou senha inválidos.";
  if (x?.type === "general_rate_limit_exceeded" || x?.code === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  // O Appwrite usa 401 tanto para "não está logado" quanto para "logado, mas sem permissão na tabela".
  if (x?.type === "user_unauthorized" || (x?.code === 401 && /not authorized/i.test(m)))
    return "Sem permissão nesta tabela do Appwrite. Em Databases, abra a tabela, Settings, Permissions: em submissions, dê Users → Create e ligue Row security; em published, dê Any → Read.";
  const col = m.match(/attribute not found in schema:?\s*(\w+)/i);
  if (col) return `Falta a coluna "${col[1]}" na tabela do Appwrite. Crie uma coluna do tipo String com esse nome exato.`;
  if (/index not found|requires an index/i.test(m)) return "Falta um índice na tabela do Appwrite (aba Indexes). Veja a lista no README.";
  if (/collection with the requested id/i.test(m) || /table with the requested id/i.test(m)) return "Tabela não encontrada no Appwrite. Confira o ID da tabela.";
  if (x?.code === 401) return "Você precisa entrar para continuar.";
  if (x?.code === 400 && /password/i.test(m)) return "A senha deve ter pelo menos 8 caracteres.";
  if (e instanceof TypeError || /failed to fetch|network/i.test(m))
    return "Não foi possível falar com o servidor. No Appwrite, confira se o endereço deste site está liberado em Plataformas → Web.";
  return m || "Algo deu errado. Tente de novo.";
}
