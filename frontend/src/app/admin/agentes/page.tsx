"use client";

import EntityCrud, { Field } from "@/components/EntityCrud";

const fields: Field[] = [
  { name: "name", label: "Nome", type: "text", required: true },
  { name: "type", label: "Tipo", type: "select", options: [{ value: 1, label: "Individual" }, { value: 2, label: "Coletivo" }] },
  { name: "short_description", label: "Descrição curta", type: "textarea" },
  { name: "long_description", label: "Descrição completa", type: "textarea" },
  { name: "latitude", label: "Latitude", type: "number" },
  { name: "longitude", label: "Longitude", type: "number" },
  { name: "public_location", label: "Exibir localização no mapa público", type: "checkbox" },
  { name: "emailPublico", label: "E-mail público", type: "text", meta: true },
  { name: "telefonePublico", label: "Telefone público", type: "text", meta: true },
  { name: "En_Municipio", label: "Município", type: "text", meta: true },
];

export default function Page() {
  return (
    <EntityCrud title="Agentes" endpoint="/api/agents" fields={fields}
      columns={[{ key: "name", label: "Nome" }, { key: "type", label: "Tipo" }]}
      initial={{ type: 1, status: 1, public_location: true }} />
  );
}
