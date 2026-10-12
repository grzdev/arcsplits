/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          blue: "#0A84FF",
          dark: "#0F1115",
          card: "#161920",
          border: "#232834",
          muted: "#8A94A6",
          accent: "#22C55E"
        }
      }
    },
  },
  plugins: [],
};
