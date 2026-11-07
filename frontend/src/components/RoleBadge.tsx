import Icon from "@/components/Icon";

/** Mostra de forma clara se a conta é de administrador ou de agente. */
export default function RoleBadge({ admin, className = "" }: { admin: boolean; className?: string }) {
  return admin ? (
    <span className={`inline-flex items-center gap-1 rounded-full bg-sun/20 px-2.5 py-1 text-xs font-semibold text-sun-dark ${className}`}>
      <Icon name="shield" className="h-3.5 w-3.5" />
      Administrador
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark ${className}`}>
      <Icon name="agent" className="h-3.5 w-3.5" />
      Agente
    </span>
  );
}
