import type { Metadata } from "next";
import LeituraView from "@/components/LeituraView";
import { metaPost } from "@/lib/server";
import { UUID_RE } from "@/lib/site";

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const m = UUID_RE.test(id) ? await metaPost(id) : null;
  if (!m) return { title: "Publicação" };
  return {
    title: m.title,
    description: m.description ?? undefined,
    openGraph: { title: m.title, description: m.description ?? undefined, type: "article", images: m.image ? [m.image] : undefined },
    twitter: { card: m.image ? "summary_large_image" : "summary" },
  };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  return <LeituraView id={id} />;
}
