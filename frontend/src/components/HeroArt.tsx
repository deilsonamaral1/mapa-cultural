/** A jangada de Aquiraz sob o sol do litoral, desenhada em SVG (sem foto, sem direitos de imagem). */
export default function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" className={className} style={{ overflow: "visible" }} role="img" aria-label="Ilustração de uma jangada com duas velas no mar, sob o sol">
      <circle cx="372" cy="150" r="106" fill="none" stroke="#f2a516" strokeWidth="2" opacity=".4" />
      <circle cx="372" cy="150" r="78" fill="#f2a516" />

      <g className="bob">
        {/* mastro e velas */}
        <rect x="249" y="52" width="6" height="262" rx="3" fill="#dbe8f1" />
        <path d="M244 62v236H112z" fill="#ffffff" />
        <path d="M260 104v194h108z" fill="#ffb62e" stroke="#072a44" strokeWidth="2" strokeLinejoin="round" />
        {/* casco */}
        <path d="M96 306h330l-34 44H132z" fill="#06213a" />
        <path d="M96 306h330l-5 7H101z" fill="#f2a516" />
      </g>

      {/* ondas: largas o bastante para sair da área visível sem cortes retos */}
      <path d="M-640 352c40 0 40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14s40 14 80 14s40-14 80-14L1160 470H-640z" fill="#ffffff" opacity=".10" />
      <path d="M-640 376c40 0 40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12s40 12 80 12s40-12 80-12L1160 470H-640z" fill="#ffffff" opacity=".16" />
    </svg>
  );
}
