"use client";

import Link from "next/link";
import { SOURCES } from "@/lib/mapas";
import { useUser } from "@/lib/useUser";

const official = SOURCES.aquiraz.site;

// Eventos, Espaços e Agentes são lidos no mapa deste site; Projetos e Oportunidades abrem no mapa oficial.
const NAV = [
  { label: "Eventos", icon: "📅", href: "/mapa?tab=event", external: false },
  { label: "Espaços", icon: "🏛️", href: "/mapa?tab=space", external: false },
  { label: "Agentes", icon: "👤", href: "/mapa?tab=agent", external: false },
  { label: "Projetos", icon: "📋", href: `${official}/busca/##(global:(enabled:(project:!t),filterEntity:project))`, external: true },
  { label: "Oportunidades", icon: "💡", href: `${official}/busca/##(global:(enabled:(opportunity:!t),filterEntity:opportunity))`, external: true },
] as const;

const ITEM = "flex min-w-[68px] flex-col items-center justify-center gap-0.5 px-2.5 py-2 hover:bg-gray-50 sm:min-w-[84px]";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Mapa Cultural de Aquiraz — início">
      <svg width="34" height="40" viewBox="0 0 24 28" aria-hidden>
        <defs>
          <linearGradient id="pin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5a400" />
            <stop offset=".5" stopColor="#d0123e" />
            <stop offset="1" stopColor="#1b4f8a" />
          </linearGradient>
        </defs>
        <path d="M12 1C7.6 1 4 4.6 4 9c0 6 8 17 8 17s8-11 8-17c0-4.4-3.6-8-8-8z" fill="url(#pin)" />
        <circle cx="12" cy="9" r="3.4" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span className="block text-[17px] font-extrabold uppercase tracking-tight text-[#1b4f8a]">Mapa Cultural</span>
        <span className="block text-[13px] font-bold uppercase tracking-tight text-gray-600">de Aquiraz</span>
      </span>
    </Link>
  );
}

export default function SiteHeader() {
  const { user, loading, isAdmin, logout } = useUser();

  return (
    <header className="z-20 flex shrink-0 items-stretch justify-between gap-2 border-b bg-white px-4 shadow-sm">
      <div className="flex items-center py-2">
        <Logo />
      </div>

      <nav className="flex min-w-0 items-stretch overflow-x-auto text-xs font-semibold text-gray-800">
        {NAV.map((n) => (
          // <a> comum nos links do mapa: a página /mapa lê ?tab= ao abrir
          <a key={n.label} href={n.href} className={ITEM} {...(n.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <span aria-hidden className="text-lg leading-none">{n.icon}</span>
            <span>{n.label}</span>
          </a>
        ))}

        {!loading && user && (
          <>
            {isAdmin && (
              <Link href="/admin" className={ITEM}>
                <span aria-hidden className="text-lg leading-none">🛡️</span>
                <span>Aprovações</span>
              </Link>
            )}
            <Link href="/painel" className={ITEM}>
              <span aria-hidden className="text-lg leading-none">🗂️</span>
              <span>Meu painel</span>
            </Link>
            <button
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
              className={ITEM}
            >
              <span aria-hidden className="text-lg leading-none">🚪</span>
              <span>Sair</span>
            </button>
          </>
        )}

        {!loading && !user && (
          <>
            <Link href="/entrar" className={ITEM}>
              <span aria-hidden className="text-lg leading-none">🔒</span>
              <span>Entrar</span>
            </Link>
            <Link href="/cadastro" className="my-2 ml-2 flex items-center self-center whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Cadastre-se
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
