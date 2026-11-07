"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { KINDS, SOURCES, fmtDate, type Item, type Kind } from "@/lib/mapas";

const LAT = Number(process.env.NEXT_PUBLIC_MAP_LAT ?? -3.9014);
const LNG = Number(process.env.NEXT_PUBLIC_MAP_LNG ?? -38.3892);
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 11);

export type Focus = { key: string; n: number } | null;

type Props = {
  items: Item[];
  fitKey: string; // quando muda (busca, aba, fontes), o mapa reenquadra os resultados
  focus: Focus; // clique na lista: dá zoom e abre o popup
  me: { lat: number; lng: number } | null;
  visible: boolean; // false quando o mapa está escondido (celular)
  onMarkerClick: (key: string) => void;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// o campo "site" é digitado por agentes: só aceita http(s), nunca javascript: e afins
function safeUrl(v: string | null): string | null {
  if (!v) return null;
  const s = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : null;
  return s && /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

const icons: Partial<Record<Kind, L.DivIcon>> = {};
function iconFor(kind: Kind) {
  return (icons[kind] ??= L.divIcon({
    className: "mc-pin",
    html: `<span style="background:${KINDS[kind].color}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 31], // a ponta do pino fica sobre a coordenada
    popupAnchor: [0, -32],
  }));
}

function popupHtml(it: Item) {
  const k = KINDS[it.kind];
  const desc = it.description && it.description.length > 180 ? it.description.slice(0, 177) + "…" : it.description;
  return `<div class="mc-pop">
    <span class="mc-tag" style="background:${k.color}">${esc(k.label)}</span>
    ${it.photos?.[0] ? `<img src="${esc(it.photos[0])}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:10px;margin-top:6px"/>` : ""}
    <strong>${esc(it.name)}</strong>
    ${it.place ? `<div>${esc(it.place)}</div>` : ""}
    ${it.startsAt ? `<div>${esc(fmtDate(it.startsAt))}</div>` : ""}
    ${desc ? `<p>${esc(desc)}</p>` : ""}
    ${it.contact ? `<div>${esc(it.contact)}</div>` : ""}
    ${safeUrl(it.site) ? `<a href="${esc(safeUrl(it.site)!)}" target="_blank" rel="noopener noreferrer">Site ou rede social ↗</a><br/>` : ""}
    ${it.entryId ? `<a href="/ver?id=${esc(it.entryId)}">Ver fotos e detalhes</a><br/>` : ""}
    ${it.url ? `<a href="/oficial?s=${esc(it.source)}&k=${esc(it.kind)}&id=${it.id}">Ver detalhes</a>` : ""}
  </div>`;
}

function Layer({ items, fitKey, focus, me, visible, onMarkerClick }: Props) {
  const map = useMap();
  const group = useRef<any>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const lastFit = useRef<string | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  // pontos
  useEffect(() => {
    const g = (L as any).markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, chunkedLoading: true });
    const byKey = new Map<string, L.Marker>();
    for (const it of items) {
      if (it.lat == null || it.lng == null) continue;
      const m = L.marker([it.lat, it.lng], { icon: iconFor(it.kind), title: it.name });
      m.bindPopup(popupHtml(it), { maxWidth: 280 });
      m.on("click", () => clickRef.current(it.key));
      byKey.set(it.key, m);
      g.addLayer(m);
    }
    markers.current = byKey;
    group.current = g;
    map.addLayer(g);

    // reenquadra só quando a busca mudou (não no carregamento inicial, que fica centrado na cidade)
    if (lastFit.current !== null && lastFit.current !== fitKey && byKey.size > 0) {
      map.fitBounds(g.getBounds(), { padding: [40, 40], maxZoom: 14 });
    }
    lastFit.current = fitKey;
    return () => {
      map.removeLayer(g);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, map]);

  // clique na lista
  useEffect(() => {
    if (!focus) return;
    const m = markers.current.get(focus.key);
    if (m && group.current) group.current.zoomToShowLayer(m, () => m.openPopup());
  }, [focus]);

  // posição do usuário
  useEffect(() => {
    if (!me) return;
    const dot = L.circleMarker([me.lat, me.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map);
    dot.bindTooltip("Você está aqui");
    map.setView([me.lat, me.lng], 13);
    return () => {
      dot.remove();
    };
  }, [me, map]);

  // mapa estava escondido: recalcula o tamanho
  useEffect(() => {
    if (visible) setTimeout(() => map.invalidateSize(), 50);
  }, [visible, map]);

  return null;
}

export default function MapView(props: Props) {
  return (
    <MapContainer center={[LAT, LNG]} zoom={ZOOM} className="h-full w-full" scrollWheelZoom zoomControl={false}>
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Layer {...props} />
    </MapContainer>
  );
}
