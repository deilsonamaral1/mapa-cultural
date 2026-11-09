"use client";

import { useEffect } from "react";

/** Registra o "service worker": deixa o site instalável no celular e guarda páginas já abertas para uso sem internet. */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
