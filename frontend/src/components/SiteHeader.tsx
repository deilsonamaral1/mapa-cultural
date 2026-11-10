"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import RoleBadge from "@/components/RoleBadge";
import { KINDS, KIND_ORDER, type Kind } from "@/lib/mapas";
import { useUser } from "@/lib/useUser";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Mapa Cultural de Aquiraz, página inicial">
      <svg className="h-9 w-9 sm:h-[38px] sm:w-[38px]" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill={light ? "#ffffff" : "#0b3a5c"} />
        <path d="M19 7v21H9z" fill={light ? "#0b3a5c" : "#ffffff"} />
        <path d="M21.5 11v17H31z" fill="#f2a516" />
        <path d="M7 30.5h26l-3.2 4.5H10.2z" fill={light ? "#0b3a5c" : "#ffffff"} />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-[17px] font-bold sm:text-[19px] ${light ? "text-white" : "text-sea"}`}>Mapa Cultural</span>
        <span className={`mt-0.5 block text-[13px] font-medium ${light ? "text-white/70" : "text-slate-500"}`}>de Aquiraz</span>
      </span>
    </Link>
  );
}

export default function SiteHeader() {
  const { user, loading, isStaff, logout } = useUser();
  const [pendentes, setPendentes] = useState(0);
  const [formsNovos, setFormsNovos] = useState(0);
  const [tab, setTab] = useState<Kind | null>(null);
  const [onMapa, setOnMapa] = useState(false);

  // destaca a categoria aberta em /mapa?tab=... (lido no navegador, sem useSearchParams)
  useEffect(() => {
    setOnMapa(window.location.pathname === "/mapa");
    if (window.location.pathname !== "/mapa") return;
    const t = new URLSearchParams(window.location.search).get("tab") as Kind | null;
    setTab(t && t in KINDS ? t : "event");
  }, []);

  // equipe: número de cadastros e textos esperando aprovação
  useEffect(() => {
    if (!isStaff) return;
    Promise.all([
      supabase.from("mc_cadastros").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("mc_posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]).then(([a, b]) => setPendentes((a.count ?? 0) + (b.count ?? 0)));
  }, [isStaff]);

  // agente: formulários enviados pela equipe que ainda não foram respondidos
  useEffect(() => {
    if (!user) return;
    supabase.rpc("mc_meus_formularios").then((r) => {
      if (!r.error) setFormsNovos(((r.data ?? []) as { respondido: boolean }[]).filter((f) => !f.respondido).length);
    });
  }, [user]);

  const nav = (
    <>
      {KIND_ORDER.map((k) => (
        // <a> comum: a página /mapa lê ?tab= ao abrir
        <a
          key={k}
          href={`/mapa?tab=${k}`}
          aria-current={tab === k ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
            tab === k ? "bg-sea text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Icon name={k} className="h-[18px] w-[18px]" />
          {KINDS[k].plural}
        </a>
      ))}
      <a href="/blog" className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
        <Icon name="blog" className="h-[18px] w-[18px]" />
        Blog
      </a>
      <a href="/podcast" className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
        <Icon name="mic" className="h-[18px] w-[18px]" />
        Podcast
      </a>
    </>
  );

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />

        <nav aria-label="Categorias" className="hidden items-center gap-1 lg:flex">{nav}</nav>

        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Link href="/busca" aria-label="Buscar" className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
            <Icon name="search" className="h-5 w-5" />
          </Link>
          <Link href="/favoritos" aria-label="Salvos" className="hidden h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 sm:grid">
            <Icon name="heart" className="h-5 w-5" />
          </Link>
          {!loading && user && (
            <>
              {isStaff && (
                <Link href="/admin" aria-label={pendentes ? `Administração, ${pendentes} pendente(s)` : "Administração"} className="relative flex items-center gap-1.5 rounded-full bg-sun/15 px-3 py-2 text-sun-dark hover:bg-sun/25 sm:px-3.5">
                  <Icon name="shield" className="h-[18px] w-[18px]" />
                  <span className="hidden sm:inline">Administração</span>
                  {pendentes > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">{pendentes > 99 ? "99+" : pendentes}</span>}
                </Link>
              )}
              {!isStaff && <RoleBadge papel="agente" className="hidden md:inline-flex" />}
              <Link href="/painel" aria-label={formsNovos ? `Meu painel, ${formsNovos} formulário(s) novo(s)` : "Meu painel"} className="relative flex items-center gap-1.5 rounded-full bg-sea px-3 py-2 text-white hover:bg-sea-deep sm:px-3.5">
                <Icon name="panel" className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Meu painel</span>
                {formsNovos > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">{formsNovos > 99 ? "99+" : formsNovos}</span>}
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = "/";
                }}
                aria-label="Sair"
                title="Sair"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
              >
                <Icon name="logout" className="h-[18px] w-[18px]" />
              </button>
            </>
          )}

          {!loading && !user && (
            <>
              <Link href="/entrar" aria-label="Entrar" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100 sm:px-3.5">
                <Icon name="lock" className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Entrar</span>
              </Link>
              <Link href="/cadastro" className="rounded-full bg-sun px-3.5 py-2 font-semibold text-ink shadow-sm sm:px-4 hover:bg-[#ffb62e]">
                Cadastre-se
              </Link>
            </>
          )}
        </div>
      </div>

      {/* celular e tablet: categorias em uma faixa que rola para o lado */}
      <nav aria-label="Categorias" className={`${onMapa ? "hidden" : "flex"} no-scrollbar gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden`}>{nav}</nav>
    </header>
  );
}
