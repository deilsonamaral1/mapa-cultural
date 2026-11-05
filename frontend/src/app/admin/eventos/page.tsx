"use client";

import EntityCrud, { Field } from "@/components/EntityCrud";

const fields: Field[] = [
  { name: "name", label: "Nome do evento", type: "text", required: true },
  { name: "agent_id", label: "Agente organizador", type: "ref", refEndpoint: "/api/agents", required: true },
  { name: "space_id", label: "Espaço", type: "ref", refEndpoint: "/api/spaces" },
  { name: "starts_at", label: "Início", type: "datetime" },
  { name: "ends_at", label: "Fim", type: "datetime" },
  { name: "type", label: "Linguagem", type: "select", options: [
    { value: 1, label: "Música" }, { value: 2, label: "Teatro" }, { value: 3, label: "Dança" },
    { value: 4, label: "Literatura" }, { value: 5, label: "Artes visuais" }, { value: 6, label: "Outro" },
  ] },
  { name: "short_description", label: "Descrição curta", type: "textarea" },
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
