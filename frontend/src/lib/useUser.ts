"use client";

import { useCallback, useEffect, useState } from "react";
import { T, supabase } from "@/lib/supabase";

export type AppUser = { id: string; email: string; name: string };

/** Usuário logado. `isAdmin` vem da tabela mc_perfis (papel = 'admin'); quem protege os dados são as regras do banco. */
export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        setUser(null);
        setIsAdmin(false);
        return;
      }
      setUser({ id: u.id, email: u.email ?? "", name: (u.user_metadata?.name as string) ?? "" });
      const p = await supabase.from(T.perfis).select("papel").eq("id", u.id).maybeSingle();
      setIsAdmin(p.data?.papel === "admin");
    } catch {
      setUser(null);
      setIsAdmin(false);
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
    setIsAdmin(false);
  }, []);

  return { user, loading, isAdmin, refresh, logout };
}
