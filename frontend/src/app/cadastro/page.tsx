import Link from "next/link";
import { SOURCES } from "@/lib/mapas";

export const metadata = { title: "Cadastre-se · Mapa Cultural" };

const steps = [
  "Crie sua conta no Mapa Cultural oficial (botão abaixo).",
  "No painel, abra “Meus Agentes” e preencha o perfil do agente, espaço ou evento.",
  "Quando o cadastro for publicado, ele passa a aparecer aqui automaticamente.",
];

export default function CadastroPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-soft p-4">
      <div className="w-full max-w-md space-y-5 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-brand-dark">Cadastre-se como agente cultural</h1>
        <p className="text-sm text-gray-600">
          Este mapa é alimentado pelos Mapas Culturais oficiais. Por isso o cadastro é feito direto neles:
          você cria a conta uma vez e seu perfil aparece aqui e no mapa oficial.
        </p>

        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <div className="space-y-2">
          <a
            href={`${SOURCES.aquiraz.site}/autenticacao/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded bg-brand px-4 py-2.5 text-center font-medium text-white hover:bg-brand-dark"
          >
            Cadastrar no Mapa Cultural de Aquiraz
          </a>
          <a
            href={`${SOURCES.estado.site}/autenticacao/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded border border-brand px-4 py-2.5 text-center font-medium text-brand-dark hover:bg-brand-soft"
          >
            Cadastrar no Mapa Cultural do Ceará
          </a>
        </div>

        <p className="text-center text-sm text-gray-600">
          <Link href="/" className="text-brand-dark underline">← Voltar ao mapa</Link>
        </p>
      </div>
    </main>
  );
}
