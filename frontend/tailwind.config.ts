import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Editorial serif for display headings, refined sans for body.
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        // Cured-tobacco / botanical palette — warm greens, earth, parchment.
        leaf: {
          50: "#f3f7f1",
          100: "#e3ecdf",
          200: "#c7d9bf",
          300: "#a4be96",
          400: "#7fa06b",
          500: "#5d834a",
          600: "#456838",
          700: "#37532e",
          800: "#2d4226",
          900: "#1c2917",
        },
        tobacco: {
          50: "#faf6ee",
          100: "#f0e6cc",
          200: "#e1cd99",
          300: "#cdaf6b",
          400: "#b89249",
          500: "#9a763a",
          600: "#7c5d2f",
          700: "#5e4524",
          800: "#3f2e18",
          900: "#1f170c",
        },
        parchment: "#f7f3e9",
        ink: "#1a1d1a",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
        card: "0 1px 0 rgba(0,0,0,0.02), 0 8px 28px rgba(31,42,28,0.08)",
        glow: "0 0 0 1px rgba(93,131,74,0.18), 0 12px 40px rgba(93,131,74,0.18)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "fade-up": "fadeUp 0.6s ease forwards",
        shimmer: "shimmer 2s linear infinite",
        leaf: "leaf 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        leaf: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
