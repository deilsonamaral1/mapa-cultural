import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { KINDS, SOURCES } from "@/lib/mapas";

// Fotos opcionais em frontend/public/hero/1.jpg, 2.jpg e 3.jpg (veja LEIAME.txt na pasta).
// Sem as fotos, cada painel mostra só o degradê.
const PANELS = [
  { img: "/hero/1.jpg", bg: "linear-gradient(180deg,#6fb9e6 0%,#cfe9f7 55%,#e6cf9b 100%)", mark: "⛵" },
  { img: "/hero/2.jpg", bg: "linear-gradient(180deg,#9fd0ee 0%,#f4f1e8 60%,#e8c34a 100%)", mark: "⛪" },
  { img: "/hero/3.jpg", bg: "linear-gradient(160deg,#ebbd4f 0%,#d98a2b 60%,#a9591f 100%)", mark: "🏛️" },
];

const CARDS = [
  { tab: "event", icon: "📅", text: "Shows, oficinas, festas populares e programação cultural dos próximos dias." },
  { tab: "space", icon: "🏛️", text: "Teatros, museus, casas de cultura, pontos de cultura e outros lugares da cidade." },
  { tab: "agent", icon: "👤", text: "Artistas, mestres da cultura popular, coletivos e grupos culturais." },
] as const;

const STEPS = [
  { n: 1, title: "Crie sua conta", text: "O cadastro é feito no Mapa Cultural oficial, uma única vez." },
  { n: 2, title: "Preencha seu perfil", text: "Cadastre o agente, o espaço ou o evento, com fotos, descrição e localização." },
  { n: 3, title: "Apareça no mapa", text: "Depois de publicado, o seu cadastro passa a aparecer aqui e no mapa oficial." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* atalhos coloridos na lateral (computador) */}
      <nav aria-label="Atalhos" className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col md:flex">
        {[
          { t: "Início", i: "🏠", c: "#1b4f8a", h: "/" },
          { t: "Eventos", i: "📅", c: "#b9c60f", h: "/mapa?tab=event" },
          { t: "Agentes", i: "👤", c: "#1fb5b0", h: "/mapa?tab=agent" },
          { t: "Espaços", i: "🏛️", c: "#e0307a", h: "/mapa?tab=space" },
        ].map((x) => (
          <a key={x.t} href={x.h} title={x.t} aria-label={x.t} className="grid h-11 w-11 place-items-center text-lg text-white transition hover:w-14" style={{ background: x.c }}>
            {x.i}
          </a>
        ))}
      </nav>

      {/* ---------- boas-vindas ---------- */}
      <section className="relative isolate overflow-hidden bg-[#1b4f8a]">
        <div className="absolute inset-0 -z-10 grid grid-cols-1 gap-3 p-3 md:grid-cols-3" aria-hidden>
          {PANELS.map((p, i) => (
            <div
              key={p.img}
              className={`relative overflow-hidden rounded-sm ${i > 0 ? "hidden md:block" : ""}`}
              style={{ backgroundImage: `url(${p.img}), ${p.bg}`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <span className="absolute bottom-2 right-4 select-none text-[8rem] leading-none opacity-25">{p.mark}</span>
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e2f56]/80 via-[#0e2f56]/35 to-transparent" />
        </div>

        <div className="mx-auto max-w-5xl px-6 py-16 text-white md:py-28 md:pl-20">
          <h1 className="font-serif text-4xl font-bold drop-shadow sm:text-6xl">Bem-vind@!</h1>
          <p className="mt-4 max-w-xl text-lg drop-shadow">
            Descubra os eventos, espaços e agentes culturais de {process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz"} e de todo o Ceará, em um só mapa.
          </p>

          <form action="/mapa" method="get" className="mt-7 flex max-w-2xl flex-col overflow-hidden rounded shadow-lg sm:flex-row" role="search">
            <input
              name="q"
              placeholder="Digite uma palavra-chave"
              aria-label="Palavra-chave"
              className="!rounded-none !border-0 !px-4 !py-3.5 !text-base text-ink"
            />
            <select name="tab" aria-label="Buscar em" defaultValue="event" className="!w-auto !rounded-none !border-0 !border-l !px-3 !py-3.5 text-ink">
              <option value="event">Eventos</option>
              <option value="space">Espaços</option>
              <option value="agent">Agentes</option>
            </select>
            <button className="bg-ink px-6 py-3.5 font-semibold text-white hover:bg-black">🔎 Buscar</button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/cadastro" className="rounded bg-brand px-6 py-3 font-semibold text-white shadow hover:bg-brand-dark">
              Colabore com o Mapas Culturais
            </Link>
            <Link href="/mapa" className="rounded border border-white/80 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Ver o mapa →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- o que você encontra ---------- */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-2xl font-bold text-ink">Explore o mapa</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CARDS.map((c) => (
            <a
              key={c.tab}
              href={`/mapa?tab=${c.tab}`}
              className="group rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderTop: `4px solid ${KINDS[c.tab].color}` }}
            >
              <div className="text-3xl">{c.icon}</div>
              <h3 className="mt-2 text-lg font-semibold">{KINDS[c.tab].plural}</h3>
              <p className="mt-1 text-sm text-gray-600">{c.text}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand-dark group-hover:underline">Abrir no mapa →</span>
            </a>
          ))}
        </div>
      </section>

      {/* ---------- como participar ---------- */}
      <section className="bg-brand-soft">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-2xl font-bold text-ink">Faça parte</h2>
          <p className="mt-1 text-gray-600">Quem faz cultura na cidade tem lugar no mapa. É gratuito.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-lg bg-white p-5 shadow-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-bold text-white">{s.n}</span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
          <Link href="/cadastro" className="mt-7 inline-block rounded bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark">
            Quero me cadastrar
          </Link>
        </div>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-gray-500">
        Dados dos mapas oficiais:{" "}
        <a className="underline" href={SOURCES.aquiraz.site} target="_blank" rel="noopener noreferrer">Mapa Cultural de Aquiraz</a>
        {" · "}
        <a className="underline" href={SOURCES.estado.site} target="_blank" rel="noopener noreferrer">Mapa Cultural do Ceará</a>
        <div className="mt-1">Mapa: © colaboradores do OpenStreetMap</div>
      </footer>
    </div>
  );
}
