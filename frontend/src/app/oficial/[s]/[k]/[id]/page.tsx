import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OficialView from "@/components/OficialView";
import { KINDS, SOURCES, type Kind, type OfficialKey } from "@/lib/mapas";
import { metaOficial } from "@/lib/server";

type P = { params: Promise<{ s: string; k: string; id: string }> };

function parse({ s, k, id }: { s: string; k: string; id: string }) {
  const n = Number(id);
  if (!(s in SOURCES) || s === "local" || !(k in KINDS) || !Number.isInteger(n) || n <= 0) return null;
  return { s: s as OfficialKey, k: k as Kind, id: n };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = parse(await params);
  const m = a ? await metaOficial(a.s, a.k, a.id) : null;
  if (!m) return { title: "Cadastro" };
  return {
    title: m.title,
    description: m.description ?? undefined,
    openGraph: { title: m.title, description: m.description ?? undefined, images: m.image ? [m.image] : undefined },
    twitter: { card: m.image ? "summary_large_image" : "summary" },
  };
}

export default async function Page({ params }: P) {
  const a = parse(await params);
  if (!a) notFound();
  return <OficialView s={a.s} k={a.k} id={a.id} />;
}
