"use client";

import { useCallback, useEffect, useState } from "react";
import { T, supabase } from "@/lib/supabase";

export type Papel = "agente" | "moderador" | "admin";
export type AppUser = { id: string; email: string; name: string };

/** Usuário logado. `isAdmin` vem da tabela mc_perfis (papel = 'admin'); quem protege os dados são as regras do banco. */
export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [papel, setPapel] = useState<Papel>("agente");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        setUser(null);
        setPapel("agente");
        return;
      }
      setUser({ id: u.id, email: u.email ?? "", name: (u.user_metadata?.name as string) ?? "" });
      const p = await supabase.from(T.perfis).select("papel").eq("id", u.id).maybeSingle();
      setPapel(p.data?.papel === "admin" || p.data?.papel === "moderador" ? p.data.papel : "agente");
    } catch {
      setUser(null);
      setPapel("agente");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* já estava deslogado */
    }
    setUser(null);
    setPapel("agente");
  }, []);

  return { user, loading, papel, isAdmin: papel === "admin", isStaff: papel !== "agente", refresh, logout };
}
