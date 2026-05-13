import type { Config } from "tailwindcss";

// Conecta tokens Tailwind a CSS variables con soporte completo de opacidad.
// Ejemplo: bg-dojo-card/40 → background: rgb(var(--card) / 0.4)
// Al cambiar data-theme, TODOS los componentes se tematizán automáticamente.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dojo: {
          // Conectados a CSS variables — cambian con el tema
          darker:  "rgb(var(--c-bg)      / <alpha-value>)",
          dark:    "rgb(var(--c-sidebar)  / <alpha-value>)",
          card:    "rgb(var(--c-card)     / <alpha-value>)",
          border:  "rgb(var(--c-border)   / <alpha-value>)",
          white:   "rgb(var(--c-text-1)   / <alpha-value>)",
          muted:   "rgb(var(--c-text-2)   / <alpha-value>)",
          red:     "rgb(var(--c-primary)  / <alpha-value>)",
          success: "rgb(var(--c-success)  / <alpha-value>)",
          warning: "rgb(var(--c-warning)  / <alpha-value>)",
          info:    "rgb(var(--c-primary)  / <alpha-value>)",
          // Fijos — no cambian con el tema
          gold:    "#F39C12",
          accent:  "#E74C3C",
        },
      },
      fontFamily: {
        display: ["Cinzel", "serif"],
        body:    ["Nunito", "sans-serif"],
        inter:   ["Inter",  "sans-serif"],
        poppins: ["Poppins","sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
