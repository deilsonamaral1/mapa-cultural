import { youtubeIds } from "@/lib/media";

/** Fotos (grade) e vídeos do YouTube (player embutido, mas o vídeo continua hospedado no YouTube). */
export default function Media({ photos = [], videos = [] }: { photos?: string[]; videos?: string[] }) {
  const ids = youtubeIds(videos);
  if (!photos.length && !ids.length) return null;
  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <ul className={`grid gap-2 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {photos.map((src) => (
            <li key={src}>
              <a href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {ids.map((id) => (
        <div key={id}>
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title="Vídeo do YouTube"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          </div>
          <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-slate-500 underline">
            Abrir no YouTube
          </a>
        </div>
      ))}
    </div>
  );
}
