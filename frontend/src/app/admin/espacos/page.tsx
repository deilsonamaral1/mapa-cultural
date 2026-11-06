"use client";

import EntityCrud, { Field } from "@/components/EntityCrud";
import { SPACE_TYPES } from "@/lib/spaceTypes";

const fields: Field[] = [
  { name: "name", label: "Nome do espaço", type: "text", required: true },
  { name: "agent_id", label: "Agente responsável", type: "ref", refEndpoint: "/api/agents", required: true },
  // IDs oficiais do Mapas Culturais (gerados de src/conf/space-types.php)
  { name: "type", label: "Tipo", type: "select", options: SPACE_TYPES },
  { name: "short_description", label: "Descrição curta (obrigatória para publicar, até 400 caracteres)", type: "textarea", maxLength: 400 },
  { name: "long_description", label: "Descrição completa", type: "textarea" },
  { name: "latitude", label: "Latitude (obrigatória para publicar)", type: "number" },
  { name: "longitude", label: "Longitude (obrigatória para publicar)", type: "number" },
  { name: "public", label: "Espaço aberto: qualquer agente pode cadastrar eventos aqui", type: "checkbox" },
  { name: "acessibilidade", label: "Acessibilidade", type: "select", meta: true, options: [
    { value: "", label: "Não informado" }, { value: "Sim", label: "Sim" }, { value: "Não", label: "Não" },
  ] },
  { name: "capacidade", label: "Capacidade (número inteiro positivo)", type: "text", meta: true },
  { name: "horario", label: "Horário de funcionamento", type: "text", meta: true },
];

export default function Page() {
  return (
    <EntityCrud title="Espaços" endpoint="/api/spaces" fields={fields}
      columns={[{ key: "name", label: "Nome" }, { key: "type", label: "Tipo" }]}
      initial={{ type: 40, status: 1, public: false }} />
  );
}
