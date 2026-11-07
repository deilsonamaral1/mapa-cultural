import type { Config } from "tailwindcss";

// Identidade visual: azul do Atlântico, ocre das fachadas coloniais, branco de cal.
// Para trocar as cores da marca, edite só este arquivo.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f4c75", dark: "#0a3554", soft: "#e6f0f6" },
        sea: { deep: "#072a44", DEFAULT: "#0b3a5c", mid: "#1c6a9b" },
        sun: { DEFAULT: "#f2a516", dark: "#b87500" },
        cal: "#f5f7f6",
        ink: "#0e1b26",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(7,42,68,.06), 0 8px 24px -8px rgba(7,42,68,.18)",
      },
    },
  },
  plugins: [],
};
export default config;
