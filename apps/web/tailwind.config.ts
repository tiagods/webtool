import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: '#05354C',
        accent: '#0099FF',
        sky: '#6CBCDA',
        success: '#16a34a',
        error: '#DC2626',
        text: '#1C1C1C',
        textAlt: '#28282B',
        muted: '#999999',
        border: '#E5E5E8',
        surface: '#FFFFFF',
        surfaceAlt: '#F9F9F9',
        warm: '#FCFCFA',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter Display', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
