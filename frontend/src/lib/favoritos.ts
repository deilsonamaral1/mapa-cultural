"use client";

import { useCallback, useEffect, useState } from "react";

export type Favorito = { href: string; name: string; kind: string; savedAt: number };
const KEY = "mc-favoritos";

function read(): Favorito[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.href === "string" && typeof x.name === "string") : [];
  } catch {
    return [];
  }
}

/** Favoritos ficam só neste aparelho (sem conta). */
export function useFavoritos() {
  const [list, setList] = useState<Favorito[]>([]);
  useEffect(() => setList(read()), []);

  const toggle = useCallback((f: Omit<Favorito, "savedAt">) => {
    const cur = read();
    const next = cur.some((x) => x.href === f.href) ? cur.filter((x) => x.href !== f.href) : [{ ...f, savedAt: Date.now() }, ...cur];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sem espaço ou bloqueado */
    }
    setList(next);
  }, []);

  return { list, toggle, has: (href: string) => list.some((x) => x.href === href) };
}
