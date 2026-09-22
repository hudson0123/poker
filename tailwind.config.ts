import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0D7377", dark: "#0A5C5F", light: "#10959A" },
        secondary: { DEFAULT: "#1B2A4A", light: "#2A3F6E" },
        accent: { DEFAULT: "#F5A623", light: "#F7BC5C" },
        surface: "#FFFFFF",
        background: "#F7F8FA",
        success: "#2ECC71",
        muted: "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
