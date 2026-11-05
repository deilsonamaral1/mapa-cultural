"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export type Item = {
  id: number;
  name: string;
  description?: string | null;
  latitude: number | null;
  longitude: number | null;
  place?: string | null;
  starts_at?: string | null;
};

const LAT = Number(process.env.NEXT_PUBLIC_MAP_LAT ?? -3.9014);
const LNG = Number(process.env.NEXT_PUBLIC_MAP_LNG ?? -38.3892);
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 12);

export default function MapView({ items }: { items: Item[] }) {
  return (
    <MapContainer center={[LAT, LNG]} zoom={ZOOM} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map(
        (it) =>
          it.latitude != null &&
          it.longitude != null && (
            <CircleMarker
              key={it.id}
              center={[it.latitude, it.longitude]}
              radius={9}
              pathOptions={{ color: "#8a3216", fillColor: "#b4451f", fillOpacity: 0.85 }}
            >
              <Popup>
                <strong>{it.name}</strong>
                {it.place && <div>{it.place}</div>}
                {it.starts_at && <div>{new Date(it.starts_at).toLocaleString("pt-BR")}</div>}
                {it.description && <p className="mt-1">{it.description}</p>}
              </Popup>
            </CircleMarker>
          ),
      )}
    </MapContainer>
  );
}
