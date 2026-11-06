"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ID, account, errMsg } from "@/lib/appwrite";
import { SOURCES } from "@/lib/mapas";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // campo isca: pessoas não veem, robôs preenchem
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return; // robô: não faz nada
    setBusy(true);
    setError("");
    try {
      await account.create(ID.unique(), email.trim().toLowerCase(), password, name.trim());
      await account.createEmailPasswordSession(email.trim().toLowerCase(), password);
      router.replace("/painel");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-soft p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-brand-dark">Cadastre-se como agente cultural</h1>
        <p className="text-sm text-gray-600">
          Crie sua conta, cadastre seu perfil, espaço ou evento e acompanhe o status. Tudo passa por aprovação da equipe antes de aparecer no mapa.
        </p>
        <div><label>Nome do agente ou coletivo<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label></div>
        <div><label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label></div>
        <div><label>Senha (mín. 8 caracteres)<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label></div>
        {/* honeypot */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-brand px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Criando…" : "Criar cadastro"}
        </button>
        <p className="text-center text-sm text-gray-600">
          Já tem conta? <Link href="/entrar" className="text-brand-dark underline">Entrar</Link>
        </p>
        <p className="border-t pt-3 text-center text-xs text-gray-500">
          Prefere cadastrar direto nos mapas oficiais?{" "}
          <a className="underline" href={`${SOURCES.aquiraz.site}/autenticacao/`} target="_blank" rel="noopener noreferrer">Aquiraz</a>
          {" · "}
          <a className="underline" href={`${SOURCES.estado.site}/autenticacao/`} target="_blank" rel="noopener noreferrer">Ceará</a>
        </p>
        <p className="text-center text-sm"><Link href="/" className="text-brand-dark underline">← Voltar ao início</Link></p>
      </form>
    </main>
  );
}
