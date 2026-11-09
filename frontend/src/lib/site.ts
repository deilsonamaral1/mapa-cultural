export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mapaculturalaquiraz.netlify.app").replace(/\/$/, "");
export const SITE_NAME = `Mapa Cultural de ${process.env.NEXT_PUBLIC_CITY_NAME ?? "Aquiraz"}`;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
