import { embedFor } from "@/lib/youtube";

/** Player do podcast: arquivo de áudio próprio e/ou player embutido (Spotify, YouTube, SoundCloud). */
export default function PostPlayer({ audio, embed }: { audio: string | null; embed: string | null }) {
  const e = embedFor(embed);
  if (!audio && !e) return null;
  return (
    <div className="space-y-3">
      {audio && (
        <audio controls preload="none" src={audio} className="w-full">
          Seu navegador não toca áudio. <a href={audio}>Baixar o arquivo</a>.
        </audio>
      )}
      {e && (
        <iframe
          src={e.src}
          title="Player do episódio"
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className={`w-full rounded-xl border-0 ${e.height ? "" : "aspect-video"}`}
          style={e.height ? { height: e.height } : undefined}
        />
      )}
    </div>
  );
}
