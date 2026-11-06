// Em produção (Netlify) não há backend próprio: sem NEXT_PUBLIC_API_URL, o painel /admin avisa
// em vez de tentar falar com localhost (que só existe no computador de quem desenvolve).
const API = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new ApiError(0, "O painel próprio ainda não está ativado neste site (backend não configurado).");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
    localStorage.removeItem("token");
    window.location.href = "/admin/login"; // sessão expirada
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* corpo não-JSON */ }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
