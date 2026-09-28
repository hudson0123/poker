import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Talkiatry yellow. Too light for text on white (1.5:1), so it's used for
        // fills with secondary (navy) text on top; primary-ink is the readable
        // gold for text and icons.
        primary: { DEFAULT: "#FFCC34", dark: "#F5B800", light: "#FFE08A", ink: "#7A5A00" },
        secondary: { DEFAULT: "#1B2A4A", light: "#2A3F6E" },
        accent: { DEFAULT: "#F5A623", light: "#F7BC5C" },
        surface: "#FFFFFF",
        background: "#F7F8FA",
        success: "#2ECC71",
        muted: "#5B6B82",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
