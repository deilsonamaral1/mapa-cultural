/** CSV que o Excel brasileiro abre direto (separador ";" e acentos corretos). */
export function baixarCsv(nome: string, linhas: (string | number | null | undefined)[][]) {
  const cel = (v: string | number | null | undefined) => {
    const t = v == null ? "" : String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([corpo], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
