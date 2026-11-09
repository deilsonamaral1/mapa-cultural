import Icon from "@/components/Icon";
import type { Papel } from "@/lib/useUser";

/** Mostra de forma clara o papel da conta: administrador, moderador ou agente. */
export default function RoleBadge({ admin, papel, className = "" }: { admin?: boolean; papel?: Papel; className?: string }) {
  const p: Papel = papel ?? (admin ? "admin" : "agente");
  if (p === "admin")
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-sun/20 px-2.5 py-1 text-xs font-semibold text-sun-dark ${className}`}>
        <Icon name="shield" className="h-3.5 w-3.5" />
        Administrador
      </span>
    );
  if (p === "moderador")
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ${className}`}>
        <Icon name="shield" className="h-3.5 w-3.5" />
        Moderador
      </span>
    );
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark ${className}`}>
      <Icon name="agent" className="h-3.5 w-3.5" />
      Agente
    </span>
  );
}
