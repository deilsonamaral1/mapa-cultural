"use client";

import type { Models } from "appwrite";
import { useCallback, useEffect, useState } from "react";
import { account } from "@/lib/appwrite";

/** Usuário logado no Appwrite. `isAdmin` = a conta tem o rótulo "admin" (definido no console do Appwrite). */
export function useUser() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await account.get());
    } catch {
      setUser(null); // visitante (sem login)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession("current");
    } catch {
      /* já estava deslogado */
    }
    setUser(null);
  }, []);

  const isAdmin = !!user?.labels?.includes("admin");
  return { user, loading, isAdmin, refresh, logout };
}
