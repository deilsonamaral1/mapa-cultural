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

/** Player embutido para links de Spotify, YouTube e SoundCloud (qualquer outro endereço é ignorado). */
export function embedFor(url: string | null | undefined): { src: string; height: number } | null {
  if (!url) return null;
  const yt = youtubeId(url);
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt}`, height: 0 }; // height 0 = proporção 16:9
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "open.spotify.com") {
      const m = u.pathname.match(/^\/(?:intl-[\w-]+\/)?(episode|show|track|playlist|album)\/([A-Za-z0-9]+)/);
      if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === "episode" || m[1] === "track" ? 152 : 352 };
    }
    if (host === "soundcloud.com" && u.pathname.length > 1) {
      return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${u.pathname}`)}`, height: 166 };
    }
  } catch {
    /* link inválido */
  }
  return null;
}
