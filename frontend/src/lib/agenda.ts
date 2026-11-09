/** "Adicionar à agenda" de um evento: link do Google Agenda e arquivo .ics (Apple, Outlook, Android). */
export type Evento = { title: string; start: Date; end: Date | null; place?: string | null; details?: string | null; url: string };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const endOf = (e: Evento) => e.end ?? new Date(e.start.getTime() + 2 * 3600000);

export function googleAgendaUrl(e: Evento): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(endOf(e))}`,
    details: [e.details, e.url].filter(Boolean).join("\n\n"),
    location: e.place ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

export function baixarIcs(e: Evento) {
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mapa Cultural de Aquiraz//PT", "BEGIN:VEVENT",
    `UID:${stamp(e.start)}-${Math.abs([...e.title].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}@mapacultural`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(endOf(e))}`,
    `SUMMARY:${esc(e.title)}`, e.place ? `LOCATION:${esc(e.place)}` : "", `DESCRIPTION:${esc([e.details, e.url].filter(Boolean).join("\n\n"))}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "evento.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
