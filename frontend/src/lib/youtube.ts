// Funções puras (sem Supabase), usadas também em componentes de servidor.

/** Extrai o código de 11 caracteres de um link do YouTube (watch, youtu.be, shorts, embed, live). */
export function youtubeId(url: string): string | null {
  const s = url.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
        id = m ? m[1] : null;
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
