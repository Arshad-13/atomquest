/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', 
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        surface: {
          light: '#ffffff',
          dark: '#1e293b', // slate-900: elegant dark blue-gray
        },
        background: {
          light: '#f8fafc', // slate-50
          dark: '#0f172a', // slate-950
        }
      },
      fontFamily: {
        sans: ['Roboto', 'Inter', 'sans-serif'], 
      }
    },
  },
  plugins: [],
}
