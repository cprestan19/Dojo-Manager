import type { Config } from "tailwindcss";

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
          red:    "#C0392B",
          dark:   "#1A1A2E",
          darker: "#0F0F1A",
          card:   "#16213E",
          accent: "#E74C3C",
          gold:   "#F39C12",
          white:  "#F0F0F0",
          muted:  "#8892A4",
          border: "#2A3550",
          success:"#27AE60",
          warning:"#E67E22",
          info:   "#2980B9",
        },
      },
      fontFamily: {
        display: ["'Poppins'", "sans-serif"],
        body:    ["'Inter'",   "sans-serif"],
        inter:   ["'Inter'",   "sans-serif"],
        poppins: ["'Poppins'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
