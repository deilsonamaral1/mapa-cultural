import { audioUrl, coverUrl } from "@/lib/media";
import { embedFor } from "@/lib/youtube";

export type PostKind = "blog" | "podcast";
export type PostStatus = "pending" | "published" | "rejected";

export const POST_KINDS: Record<PostKind, { label: string; plural: string; path: string; color: string }> = {
  blog: { label: "Texto", plural: "Blog", path: "/blog", color: "#0f4c75" },
  podcast: { label: "Podcast", plural: "Podcast", path: "/podcast", color: "#b83a6f" },
};

export type Post = {
  id: string;
  kind: PostKind;
  title: string;
  summary: string | null;
  body: string | null;
  cover: string | null;
  audio: string | null;
  embed: string | null;
  status: PostStatus;
  note: string | null;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  publishedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
};

/** Colunas da lista (sem o texto inteiro, que pode ser grande). */
export const POST_LIST_COLS = "id, kind, title, summary, cover, audio, embed, status, note, author_id, author_name, created_at, published_at";
export const POST_ALL_COLS = `${POST_LIST_COLS}, body`;
/** Só nas telas da equipe e do autor (exige o equipe.sql rodado). */
export const POST_STAFF_COLS = `${POST_ALL_COLS}, reviewed_by_name, reviewed_at`;

export function rowToPost(r: any): Post {
  return {
    id: r.id,
    kind: r.kind === "podcast" ? "podcast" : "blog",
    title: r.title ?? "(sem título)",
    summary: r.summary ?? null,
    body: r.body ?? null,
    cover: coverUrl(r.cover),
    audio: audioUrl(r.audio),
    embed: embedFor(r.embed) ? r.embed : null, // só links de Spotify, YouTube ou SoundCloud
    status: r.status,
    note: r.note ?? null,
    authorId: r.author_id,
    authorName: r.author_name ?? null,
    createdAt: r.created_at,
    publishedAt: r.published_at ?? null,
    reviewedByName: r.reviewed_by_name ?? null,
    reviewedAt: r.reviewed_at ?? null,
  };
}

export const fmtPostDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "";
