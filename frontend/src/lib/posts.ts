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
};

/** Colunas da lista (sem o texto inteiro, que pode ser grande). */
export const POST_LIST_COLS = "id, kind, title, summary, cover, audio, embed, status, note, author_id, author_name, created_at, published_at";
export const POST_ALL_COLS = `${POST_LIST_COLS}, body`;

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
  };
}

export const fmtPostDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "";
