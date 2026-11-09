"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/SiteHeader";
import { T, errMsg, supabase } from "@/lib/supabase";

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (err) throw err;
      const p = await supabase.from(T.perfis).select("papel").eq("id", data.user.id).maybeSingle();
      router.replace(p.data?.papel === "admin" || p.data?.papel === "moderador" ? "/admin" : "/painel");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-sea-deep to-sea px-4 py-8">
      <Logo light />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lift">
        <h1 className="font-display text-2xl font-bold text-sea">Entrar</h1>
        <div><label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label></div>
        <div><label>Senha<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-sea px-4 py-3 font-semibold text-white hover:bg-sea-deep disabled:opacity-50">
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-sm text-gray-600">
          Ainda não tem conta? <Link href="/cadastro" className="text-brand-dark underline">Cadastre-se</Link>
        </p>
        <p className="text-center text-sm"><Link href="/" className="text-brand-dark underline">← Voltar ao início</Link></p>
      </form>
    </main>
  );
}
