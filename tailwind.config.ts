import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f3",
          100: "#d6ece2",
          200: "#afd8c7",
          300: "#7dbda6",
          400: "#4b9e82",
          500: "#2e8267",
          600: "#216852",
          700: "#1c5344",
          800: "#174337",
          900: "#12372e",
          950: "#091f1a",
        },
      },
      fontFamily: {
        sans: [
          '"Hind Siliguri"',
          '"Noto Sans Bengali"',
          '"Noto Sans"',
          "system-ui",
          "-apple-system",
          "'Segoe UI'",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
