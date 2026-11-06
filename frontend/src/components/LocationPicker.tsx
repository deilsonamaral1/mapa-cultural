"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

type Props = { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void };

function Clicker({ onChange }: Pick<Props, "onChange">) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

// acompanha o ponto quando ele muda por fora (botão "usar minha localização")
function Follow({ lat, lng }: Pick<Props, "lat" | "lng">) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const has = lat != null && lng != null;
  return (
    <MapContainer center={has ? [lat, lng] : [-3.9014, -38.3892]} zoom={has ? 15 : 12} className="h-64 w-full rounded border" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicker onChange={onChange} />
      <Follow lat={lat} lng={lng} />
      {has && <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: "#8a3216", fillColor: "#b4451f", fillOpacity: 0.9 }} />}
    </MapContainer>
  );
}
