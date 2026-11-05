"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // campo isca: deve ficar vazio
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ access_token?: string; role?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, website }),
      });
      if (r.access_token) {
        localStorage.setItem("token", r.access_token);
        localStorage.setItem("role", r.role ?? "agent");
      }
      router.replace("/admin/agentes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-soft p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-brand-dark">Cadastre-se como agente cultural</h1>
        <p className="text-sm text-gray-600">
          Seu perfil e tudo que você publicar passam por aprovação da equipe antes de aparecer no mapa.
        </p>
        <div><label>Nome do agente ou coletivo<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></label></div>
        <div><label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label></div>
        <div><label>Senha (mín. 10 caracteres)<input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label></div>
        {/* honeypot: escondido de pessoas, robôs costumam preencher */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-brand px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Enviando…" : "Criar cadastro"}
        </button>
        <p className="text-center text-sm text-gray-600">
          Já tem conta? <Link href="/admin/login" className="text-brand-dark underline">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
