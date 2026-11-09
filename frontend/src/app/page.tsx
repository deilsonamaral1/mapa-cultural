import Link from "next/link";
import HeroArt from "@/components/HeroArt";
import PostList from "@/components/PostList";
import Icon from "@/components/Icon";
import SiteHeader, { Logo } from "@/components/SiteHeader";
import UpcomingEvents from "@/components/UpcomingEvents";
import { KINDS, KIND_ORDER, SOURCES, type Kind } from "@/lib/mapas";

const city = process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz";

const CATEGORY_TEXT: Record<Kind, string> = {
  event: "Shows, oficinas, festas populares e a programação cultural dos próximos dias.",
  space: "Teatros, museus, casas de cultura, pontos de cultura e outros lugares onde a cultura acontece.",
  agent: "Artistas, mestres da cultura popular, coletivos e grupos culturais.",
  project: "Iniciativas e programas culturais em andamento.",
  opportunity: "Editais, chamadas e prêmios com inscrições abertas.",
};

// Eventos e espaços ganham mais destaque: são o que mais se procura.
const SPAN: Record<Kind, string> = {
  event: "md:col-span-3",
  space: "md:col-span-3",
  agent: "md:col-span-2",
  project: "md:col-span-2",
  opportunity: "md:col-span-2",
};

const STEPS = [
  { title: "Crie sua conta", text: "Leva um minuto: nome, e-mail e senha." },
  { title: "Cadastre seu trabalho", text: "Descreva seu agente, espaço ou evento e marque o local no mapa." },
  { title: "A equipe revisa e publica", text: "Depois da aprovação, você aparece no mapa para todo mundo." },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ---------- abertura ---------- */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-sea-deep via-sea to-sea-mid text-white">
        <HeroArt className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-[80%] w-auto max-w-none opacity-30 md:-right-10 md:h-[115%] md:opacity-95 lg:right-6" />

        <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 md:pb-44 md:pt-24">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">Encontre a cultura de {city}</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/85">
            Eventos, espaços, agentes, projetos e oportunidades da cidade e do Ceará, reunidos em um só mapa.
          </p>

          <form action="/busca" method="get" role="search" className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lift sm:flex-row">
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                placeholder="Digite uma palavra-chave"
                aria-label="Palavra-chave"
                className="!border-0 !bg-transparent !py-3.5 !pl-11 !text-base text-ink !shadow-none !ring-0"
              />
            </div>
            <button className="rounded-xl bg-sun px-7 py-3.5 font-semibold text-ink hover:bg-[#ffb62e]">Buscar</button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {[
              { href: "/mapa?tab=event&period=today", label: "Eventos de hoje" },
              { href: "/mapa?tab=event&period=week", label: "Eventos da semana" },
              { href: "/mapa?tab=opportunity", label: "Oportunidades abertas" },
            ].map((c) => (
              <a key={c.href} href={c.href} className="rounded-full border border-white/30 px-4 py-1.5 text-white/90 transition hover:bg-white/10">
                {c.label}
              </a>
            ))}
          </div>
        </div>

        {/* onda de transição para o fundo da página */}
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-x-0 bottom-[-1px] block h-12 w-full md:h-20">
          <path d="M0 50c120 40 240 40 360 14s240-50 360-44 240 52 360 56 240-24 360-48v62H0z" fill="#f5f7f6" />
        </svg>
      </section>

      {/* ---------- próximos eventos ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-bold">Próximos eventos em {city}</h2>
          <a href="/mapa?tab=event" className="shrink-0 text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Ver todos os eventos
          </a>
        </div>
        <UpcomingEvents />
      </section>

      {/* ---------- blog e podcast (só aparece quando há publicações) ---------- */}
      <PostList limit={3} compact home />

      {/* ---------- categorias ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="mb-6 text-3xl font-bold">Explore por categoria</h2>
        <div className="grid gap-4 md:grid-cols-6">
          {KIND_ORDER.map((k) => (
            <a
              key={k}
              href={`/mapa?tab=${k}`}
              className={`group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lift ${SPAN[k]}`}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: KINDS[k].color }}>
                <Icon name={k} className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-display text-xl font-semibold group-hover:text-brand">{KINDS[k].plural}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">{CATEGORY_TEXT[k]}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ---------- participar ---------- */}
      <section className="bg-sea-deep text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Quem faz cultura em {city} tem lugar no mapa</h2>
            <p className="mt-4 max-w-md text-white/80">É gratuito. Seu cadastro passa por uma revisão da equipe antes de aparecer para o público.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/cadastro" className="rounded-full bg-sun px-6 py-3 font-semibold text-ink hover:bg-[#ffb62e]">Criar minha conta</Link>
              <Link href="/entrar" className="rounded-full border border-white/35 px-6 py-3 font-semibold hover:bg-white/10">Já tenho conta</Link>
            </div>
          </div>

          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl bg-white/[.06] p-5 ring-1 ring-white/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sun font-display font-bold text-ink">{i + 1}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-white/75">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- rodapé ---------- */}
      <footer className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-slate-600">Os dados vêm dos Mapas Culturais oficiais e dos cadastros aprovados neste site.</p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Mapa</h3>
            <ul className="mt-3 space-y-2 text-slate-600">
              {KIND_ORDER.map((k) => (
                <li key={k}><a className="hover:text-brand hover:underline" href={`/mapa?tab=${k}`}>{KINDS[k].plural}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">Participe</h3>
            <ul className="mt-3 space-y-2 text-slate-600">
              <li><Link className="hover:text-brand hover:underline" href="/cadastro">Cadastre-se</Link></li>
              <li><Link className="hover:text-brand hover:underline" href="/formularios">Formulários abertos</Link></li>
              <li><Link className="hover:text-brand hover:underline" href="/entrar">Entrar</Link></li>
              <li><Link className="hover:text-brand hover:underline" href="/painel">Meu painel</Link></li>
              <li><Link className="hover:text-brand hover:underline" href="/admin">Administração da equipe</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
          Fontes: <a className="underline" href={SOURCES.aquiraz.site} target="_blank" rel="noopener noreferrer">Mapa Cultural de Aquiraz</a> e{" "}
          <a className="underline" href={SOURCES.estado.site} target="_blank" rel="noopener noreferrer">Mapa Cultural do Ceará</a>.
          Mapa base: colaboradores do OpenStreetMap.
        </div>
      </footer>
    </div>
  );
}
