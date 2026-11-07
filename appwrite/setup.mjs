// ALTERNATIVA ao passo a passo no painel do Appwrite (veja o README). Cria as tabelas do Mapa Cultural.
// Pode rodar mais de uma vez (ignora o que já existe).
//
//   cd appwrite
//   npm install
//   APPWRITE_API_KEY=sua_chave node setup.mjs          (Windows PowerShell: $env:APPWRITE_API_KEY="sua_chave"; node setup.mjs)
//
// A chave de API é SEGREDO: use só aqui, no seu computador. Nunca coloque no site, no GitHub ou em conversas.
// Escopos necessários na chave: databases.read e databases.write (e collections/attributes/indexes, se pedir).
import { Client, Databases, IndexType, Permission, Role } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? "https://nyc.cloud.appwrite.io/v1";
const project = process.env.APPWRITE_PROJECT_ID ?? "6aed2b790023e763ceff";
const databaseId = process.env.APPWRITE_DATABASE_ID ?? "6aed2d2f003472943abd";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error("Defina APPWRITE_API_KEY (veja as instruções no topo deste arquivo).");
  process.exit(1);
}

const db = new Databases(new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey));

/** Executa e ignora "já existe" (409), para o script poder ser repetido. */
async function once(label, fn) {
  try {
    await fn();
    console.log("  criado:", label);
  } catch (e) {
    if (e?.code === 409) console.log("  já existe:", label);
    else throw new Error(`${label}: ${e?.message ?? e}`);
  }
}

// Poucas colunas: os campos do cadastro ficam juntos, em JSON, na coluna `data`.
const str = (key, size, required = false) => ({ t: "str", key, size, required });

const COLLECTIONS = [
  {
    id: "submissions",
    name: "Cadastros enviados",
    // Qualquer pessoa logada pode ENVIAR. Só administradores (rótulo "admin") veem e alteram tudo.
    // Com document security ligado, cada agente enxerga apenas os próprios envios.
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [str("ownerId", 64, true), str("status", 16, true), str("note", 500), str("data", 10000, true)],
    indexes: [
      { key: "idx_owner", attributes: ["ownerId"] },
      { key: "idx_status", attributes: ["status"] },
    ],
  },
  {
    id: "published",
    name: "Publicados",
    // O público LÊ. Só administradores publicam, alteram e removem. Agentes não escrevem aqui.
    permissions: [
      Permission.read(Role.any()),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: false,
    attributes: [str("kind", 16, true), str("data", 10000, true)],
    indexes: [{ key: "idx_kind", attributes: ["kind"] }],
  },
];

async function addAttribute(c, a) {
  const label = `${c.id}.${a.key}`;
  return once(label, () => db.createStringAttribute(databaseId, c.id, a.key, a.size, a.required));
}

async function waitAvailable(collectionId) {
  for (let i = 0; i < 60; i++) {
    const { attributes } = await db.listAttributes(databaseId, collectionId);
    if (attributes.every((x) => x.status === "available")) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Os atributos de ${collectionId} demoraram demais para ficar prontos. Rode o script de novo.`);
}

try {
  for (const c of COLLECTIONS) {
    console.log(`\nColeção ${c.id}`);
    await once(`coleção ${c.id}`, () => db.createCollection(databaseId, c.id, c.name, c.permissions, c.documentSecurity));
    for (const a of c.attributes) await addAttribute(c, a);
    await waitAvailable(c.id);
    for (const ix of c.indexes) {
      await once(`índice ${ix.key}`, () => db.createIndex(databaseId, c.id, ix.key, IndexType.Key, ix.attributes));
    }
  }
} catch (e) {
  const msg = String(e?.message ?? e);
  console.error("\nERRO:", msg);
  if (/scope|unauthori|401|missing/i.test(msg)) {
    console.error("A chave de API não tem permissão suficiente. No Appwrite, crie outra chave marcando TODOS os escopos de");
    console.error("Databases (databases, collections, attributes, indexes e documents, leitura e escrita) e rode de novo.");
  } else if (/not be found|404/i.test(msg)) {
    console.error("Confira se o Project ID e o Database ID estão certos (veja as variáveis no topo do arquivo).");
  }
  process.exit(1);
}

console.log("\nPronto. Próximos passos:");
console.log("1) Appwrite > Auth > seu usuário > Labels: adicione  admin");
console.log("2) Appwrite > Overview > Plataformas: adicione Web com  mapaculturalaquiraz.netlify.app");
