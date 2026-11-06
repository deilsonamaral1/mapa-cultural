// Cria as coleções do Mapa Cultural no Appwrite. Pode rodar mais de uma vez (ignora o que já existe).
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

// Campos que descrevem um cadastro (iguais nas duas coleções).
const str = (key, size, required = false, array = false) => ({ t: "str", key, size, required, array });
const flt = (key) => ({ t: "flt", key });
const dt = (key) => ({ t: "dt", key });
const enm = (key, elements, required = true) => ({ t: "enm", key, elements, required });

const COMMON = [
  enm("kind", ["agent", "space", "event"]),
  str("name", 255, true),
  str("shortDescription", 400, true),
  str("longDescription", 5000),
  str("type", 100),
  str("areas", 100, false, true),
  flt("lat"),
  flt("lng"),
  str("address", 500),
  str("city", 120),
  str("place", 255), // eventos: nome do espaço
  dt("startsAt"),
  dt("endsAt"),
  str("site", 500),
  str("contact", 255),
];

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
    attributes: [
      ...COMMON,
      str("ownerId", 64, true),
      str("ownerName", 255),
      enm("status", ["pending", "approved", "rejected"]),
      str("note", 500),
    ],
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
    attributes: [...COMMON, str("submissionId", 64)],
    indexes: [{ key: "idx_kind", attributes: ["kind"] }],
  },
];

async function addAttribute(c, a) {
  const label = `${c.id}.${a.key}`;
  if (a.t === "str") return once(label, () => db.createStringAttribute(databaseId, c.id, a.key, a.size, a.required, undefined, a.array));
  if (a.t === "flt") return once(label, () => db.createFloatAttribute(databaseId, c.id, a.key, false));
  if (a.t === "dt") return once(label, () => db.createDatetimeAttribute(databaseId, c.id, a.key, false));
  if (a.t === "enm") return once(label, () => db.createEnumAttribute(databaseId, c.id, a.key, a.elements, a.required));
}

async function waitAvailable(collectionId) {
  for (let i = 0; i < 60; i++) {
    const { attributes } = await db.listAttributes(databaseId, collectionId);
    if (attributes.every((x) => x.status === "available")) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Os atributos de ${collectionId} demoraram demais para ficar prontos. Rode o script de novo.`);
}

for (const c of COLLECTIONS) {
  console.log(`\nColeção ${c.id}`);
  await once(`coleção ${c.id}`, () => db.createCollection(databaseId, c.id, c.name, c.permissions, c.documentSecurity));
  for (const a of c.attributes) await addAttribute(c, a);
  await waitAvailable(c.id);
  for (const ix of c.indexes) {
    await once(`índice ${ix.key}`, () => db.createIndex(databaseId, c.id, ix.key, IndexType.Key, ix.attributes));
  }
}

console.log("\nPronto. Próximos passos:");
console.log("1) Appwrite > Auth > seu usuário > Labels: adicione  admin");
console.log("2) Appwrite > Overview > Plataformas: adicione Web com  mapaculturalaquiraz.netlify.app");
