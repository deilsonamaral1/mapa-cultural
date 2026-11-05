"use client";

import EntityCrud, { Field } from "@/components/EntityCrud";

const fields: Field[] = [
  { name: "name", label: "Nome do espaço", type: "text", required: true },
  { name: "agent_id", label: "Agente responsável", type: "ref", refEndpoint: "/api/agents", required: true },
  { name: "type", label: "Tipo", type: "select", options: [
    { value: 1, label: "Centro cultural" }, { value: 2, label: "Teatro" },
    { value: 3, label: "Biblioteca" }, { value: 4, label: "Praça / espaço aberto" },
    { value: 5, label: "Outro" },
  ] },
  { name: "short_description", label: "Descrição curta", type: "textarea" },
  { name: "long_description", label: "Descrição completa", type: "textarea" },
  { name: "latitude", label: "Latitude", type: "number" },
  { name: "longitude", label: "Longitude", type: "number" },
  { name: "public", label: "Visível no mapa público", type: "checkbox" },
  { name: "acessibilidade", label: "Acessibilidade", type: "text", meta: true },
  { name: "capacidade", label: "Capacidade", type: "text", meta: true },
  { name: "horario", label: "Horário de funcionamento", type: "text", meta: true },
];

export default function Page() {
  return (
    <EntityCrud title="Espaços" endpoint="/api/spaces" fields={fields}
      columns={[{ key: "name", label: "Nome" }, { key: "type", label: "Tipo" }]}
      initial={{ type: 1, status: 1, public: true }} />
  );
}
