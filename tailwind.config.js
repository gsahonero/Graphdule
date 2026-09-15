/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '380px',
      },
      colors: {
        brand: {
          50: 'rgb(var(--brand-50, 240 253 244) / <alpha-value>)',
          100: 'rgb(var(--brand-100, 220 252 231) / <alpha-value>)',
          200: 'rgb(var(--brand-200, 187 247 208) / <alpha-value>)',
          300: 'rgb(var(--brand-300, 134 239 172) / <alpha-value>)',
          400: 'rgb(var(--brand-400, 74 222 128) / <alpha-value>)',
          500: 'rgb(var(--brand-500, 16 185 129) / <alpha-value>)',
          600: 'rgb(var(--brand-600, 5 150 105) / <alpha-value>)',
          700: 'rgb(var(--brand-700, 4 120 87) / <alpha-value>)',
          800: 'rgb(var(--brand-800, 6 95 70) / <alpha-value>)',
          900: 'rgb(var(--brand-900, 6 78 59) / <alpha-value>)',
          950: 'rgb(var(--brand-950, 2 44 34) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
