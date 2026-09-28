import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Higher-contrast green that stays close to the logo. Brand is used
        // for navigation/primary actions; status colours retain their meaning.
        brand: {
          50: "#effcf6",
          100: "#d9f7e9",
          200: "#b5ecd4",
          300: "#7dd9b5",
          400: "#45bd91",
          500: "#249f76",
          600: "#167f5f",
          700: "#11664f",
          800: "#10513f",
          900: "#0d4335",
          950: "#06261e",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans Bengali Variable"',
          '"Noto Sans Bengali"',
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
