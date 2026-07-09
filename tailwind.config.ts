import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#FFFFFF",
        slateLine: "#2D333A",
        surface: "#121416",
        sidebar: "#17191C",
        card: "#1C2025",
        hover: "#242A30",
        secondaryText: "#B6BDC6",
        mutedText: "#7D8590",
        estate: {
          50: "#12301f",
          100: "#164427",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D"
        },
        amberMeter: "#F59E0B",
        panel: "#17191C"
      },
      borderRadius: {
        xl: "14px",
        "2xl": "16px"
      },
      boxShadow: {
        soft: "0 18px 48px rgba(0, 0, 0, 0.28)",
        glow: "0 0 0 1px rgba(34, 197, 94, 0.16), 0 22px 60px rgba(34, 197, 94, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
