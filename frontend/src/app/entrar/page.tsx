"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
      router.replace(p.data?.papel === "admin" ? "/admin" : "/painel");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-soft p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-brand-dark">Entrar</h1>
        <div><label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label></div>
        <div><label>Senha<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-brand px-4 py-2 text-white disabled:opacity-50">
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
