import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        jade: { 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488" },
      },
    },
  },
  plugins: [],
};

export default config;
