"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { baixarIcs, googleAgendaUrl, type Evento } from "@/lib/agenda";
import { useFavoritos } from "@/lib/favoritos";

/** Compartilhar (WhatsApp e outros), favoritar e, para eventos, adicionar à agenda. */
export default function ShareBar({ title, kind, evento }: { title: string; kind: string; evento?: Omit<Evento, "url"> | null }) {
  const { has, toggle } = useFavoritos();
  const [copied, setCopied] = useState(false);
  const href = typeof window !== "undefined" ? window.location.pathname : "";
  const url = () => window.location.href;
  const fav = has(href);

  async function share() {
    try {
      if (navigator.share) return await navigator.share({ title, url: url() });
    } catch {
      return; // pessoa cancelou
    }
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copie o link:", url());
    }
  }

  const btn = "flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} className={btn}><Icon name="share" className="h-[18px] w-[18px]" />{copied ? "Link copiado!" : "Compartilhar"}</button>
      <a target="_blank" rel="noopener noreferrer" onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url()}`)}`; }} href="https://wa.me/" className={`${btn} border-green-600 text-green-700`}>WhatsApp</a>
      <button type="button" aria-pressed={fav} onClick={() => toggle({ href, name: title, kind })} className={`${btn} ${fav ? "border-red-300 bg-red-50 text-red-700" : ""}`}>
        <Icon name="heart" className={`h-[18px] w-[18px] ${fav ? "fill-current" : ""}`} />{fav ? "Salvo" : "Salvar"}
      </button>
      {evento && (
        <>
          <a target="_blank" rel="noopener noreferrer" onClick={(e) => { e.currentTarget.href = googleAgendaUrl({ ...evento, url: url() }); }} href="https://calendar.google.com/" className={btn}>
            <Icon name="event" className="h-[18px] w-[18px]" />Agenda
          </a>
          <button type="button" onClick={() => baixarIcs({ ...evento, url: url() })} className={btn}>Baixar .ics</button>
        </>
      )}
    </div>
  );
}
