import type { Config } from "tailwindcss";

// Identidade visual própria: troque as cores da marca aqui.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#b4451f", dark: "#8a3216", soft: "#fbeee8" },
        ink: "#1f1a17",
      },
      fontFamily: { sans: ["system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
