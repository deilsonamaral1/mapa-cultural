"use client";

import EntityCrud, { Field } from "@/components/EntityCrud";

// No Mapas Culturais o `type` de evento só tem o valor 1 ("Padrão"); linguagem/área são
// taxonomias (terms) e ainda não são enviadas por este painel.
const fields: Field[] = [
  { name: "name", label: "Nome do evento", type: "text", required: true },
  { name: "agent_id", label: "Agente organizador", type: "ref", refEndpoint: "/api/agents", required: true },
  { name: "space_id", label: "Espaço", type: "ref", refEndpoint: "/api/spaces" },
  { name: "starts_at", label: "Início", type: "datetime" },
  { name: "ends_at", label: "Fim", type: "datetime" },
  { name: "short_description", label: "Descrição curta (obrigatória para publicar, até 400 caracteres)", type: "textarea", maxLength: 400 },
  { name: "long_description", label: "Descrição completa", type: "textarea" },
  { name: "rules", label: "Informações / classificação", type: "textarea" },
];

export default function Page() {
  return (
    <EntityCrud title="Eventos" endpoint="/api/events" fields={fields}
      columns={[{ key: "name", label: "Nome" }, { key: "starts_at", label: "Início" }]}
      initial={{ type: 1, status: 1 }} />
  );
}
