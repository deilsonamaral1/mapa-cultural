import type { Metadata } from "next";
import VerView from "@/components/VerView";
import { metaEntrada } from "@/lib/server";
import { UUID_RE } from "@/lib/site";

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const m = UUID_RE.test(id) ? await metaEntrada(id) : null;
  if (!m) return { title: "Cadastro" };
  return {
    title: m.title,
    description: m.description ?? undefined,
    openGraph: { title: m.title, description: m.description ?? undefined, images: m.image ? [m.image] : undefined },
    twitter: { card: m.image ? "summary_large_image" : "summary" },
  };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  return <VerView id={id} />;
}
