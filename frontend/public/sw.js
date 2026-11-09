// Service worker do Mapa Cultural: instalável + páginas já visitadas funcionam sem internet.
const VERSAO = "v1";
const PAGINAS = `paginas-${VERSAO}`;
const ESTATICOS = `estaticos-${VERSAO}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (![PAGINAS, ESTATICOS].includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, mapas oficiais, OpenStreetMap: direto da rede
  if (url.pathname.startsWith("/proxy/") || url.pathname.startsWith("/api/")) return;

  // páginas: rede primeiro; sem internet, a última cópia
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const r = await fetch(req);
          if (r.ok) (await caches.open(PAGINAS)).put(req, r.clone());
          return r;
        } catch {
          const hit = (await caches.match(req)) || (await caches.match(url.pathname + url.search));
          if (hit) return hit;
          return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Sem internet</title><body style='font-family:sans-serif;padding:2rem'><h1>Sem internet</h1><p>Esta página ainda não foi aberta neste aparelho. Tente de novo quando o sinal voltar.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 });
        }
      })(),
    );
    return;
  }

  // arquivos estáticos do site: cópia guardada, atualizada em segundo plano
  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      (async () => {
        const c = await caches.open(ESTATICOS);
        const hit = await c.match(req);
        const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })(),
    );
  }
});
