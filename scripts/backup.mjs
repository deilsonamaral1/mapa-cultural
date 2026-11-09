// Exporta as tabelas mc_* do Supabase para um JSON. Roda no GitHub Actions (Node 20), não no seu computador.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backup.mjs saida.json
import { writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const out = process.argv[2] ?? "backup.json";
if (!url || !key) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const TABELAS = ["mc_perfis", "mc_cadastros", "mc_publicados", "mc_posts", "mc_formularios", "mc_respostas"];
const PAGINA = 1000;

async function tabela(nome) {
  const rows = [];
  for (let from = 0; ; from += PAGINA) {
    const r = await fetch(`${url}/rest/v1/${nome}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGINA - 1}`, "Range-Unit": "items" },
    });
    if (r.status === 404) return null; // tabela ainda não criada
    if (!r.ok && r.status !== 206) throw new Error(`${nome}: HTTP ${r.status} ${await r.text()}`);
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < PAGINA) return rows;
  }
}

const dump = { geradoEm: new Date().toISOString(), tabelas: {} };
for (const t of TABELAS) {
  const rows = await tabela(t);
  if (rows === null) {
    console.log(`${t}: não existe (ignorada)`);
    continue;
  }
  dump.tabelas[t] = rows;
  console.log(`${t}: ${rows.length} linhas`);
}
writeFileSync(out, JSON.stringify(dump));
