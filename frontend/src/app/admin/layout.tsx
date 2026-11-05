"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin/agentes", label: "Agentes" },
  { href: "/admin/espacos", label: "Espaços" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/moderacao", label: "Moderação", adminOnly: true },
  { href: "/admin/sincronizacao", label: "Sincronização", adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState("");
  const isLogin = path === "/admin/login";

  useEffect(() => {
    if (!isLogin && !localStorage.getItem("token")) router.replace("/admin/login");
    else {
      setRole(localStorage.getItem("role") ?? "");
      setReady(true);
    }
  }, [isLogin, router, path]);

  if (isLogin) return <>{children}</>;
  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 bg-brand px-5 py-3 text-white">
        <Link href="/" className="font-semibold">← Mapa</Link>
        <nav className="flex flex-1 gap-4 text-sm">
          {NAV.filter((n) => !n.adminOnly || role === "admin").map((n) => (
            <Link key={n.href} href={n.href}
              className={path.startsWith(n.href) ? "underline underline-offset-4" : "opacity-90 hover:opacity-100"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="text-sm underline-offset-2 hover:underline"
          onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("role"); router.replace("/admin/login"); }}>
          Sair
        </button>
      </header>
      {children}
    </div>
  );
}
