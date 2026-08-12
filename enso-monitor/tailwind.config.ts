import type { Config } from "tailwindcss";

/**
 * Paleta enxuta, de influência japonesa: muito branco, tinta quase-preta,
 * e uma escala divergente centrada em zero para as anomalias — azul para frio,
 * vermelho para quente, como manda a convenção climatológica.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        papel: "#fdfdfc",
        tinta: {
          900: "#1a1a18",
          700: "#3f3f3a",
          500: "#6b6b64",
          300: "#a8a8a0",
          100: "#e4e4de",
          50: "#f2f2ee",
        },
        quente: {
          fraco: "#f6d9d2",
          medio: "#e08b6f",
          forte: "#c0392b",
          intenso: "#7d1d12",
        },
        frio: {
          fraco: "#d6e3ee",
          medio: "#7ba7c7",
          forte: "#2c6ea3",
          intenso: "#123f66",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        rotulo: "0.12em",
      },
    },
  },
  plugins: [],
};

export default config;
