import { Account, Client, Databases, ID, Query } from "appwrite";
import type { Kind } from "@/lib/mapas";

// Endereço e IDs do projeto NÃO são segredo (o navegador precisa deles). A chave de API, sim:
// ela nunca entra neste site (só no script appwrite/setup.mjs, rodado no seu computador).
export const APPWRITE = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://nyc.cloud.appwrite.io/v1",
  project: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6aed2b790023e763ceff",
  database: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6aed2d2f003472943abd",
  submissions: "submissions", // o que os agentes enviam (pendente / aprovado / rejeitado)
  published: "published", // o que o público vê (só o administrador grava)
};

const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.project);
export const account = new Account(client);
export const databases = new Databases(client);
export { ID, Query };

export type EntryStatus = "pending" | "approved" | "rejected";

/** Campos de um cadastro (iguais em `submissions` e `published`). */
export type EntryData = {
  kind: Kind;
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

/** Mensagem em português para os erros do Appwrite. */
export function errMsg(e: unknown): string {
  const x = e as { code?: number; type?: string; message?: string };
  const m = x?.message ?? "";
  if (x?.type === "user_already_exists") return "Este e-mail já está cadastrado. Tente entrar.";
  if (x?.type === "user_invalid_credentials") return "E-mail ou senha inválidos.";
  if (x?.type === "general_rate_limit_exceeded" || x?.code === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (x?.code === 401) return "Você precisa entrar para continuar.";
  if (x?.code === 400 && /password/i.test(m)) return "A senha deve ter pelo menos 8 caracteres.";
  if (e instanceof TypeError || /failed to fetch|network/i.test(m))
    return "Não foi possível falar com o servidor. No Appwrite, confira se o endereço deste site está liberado em Plataformas → Web.";
  return m || "Algo deu errado. Tente de novo.";
}
