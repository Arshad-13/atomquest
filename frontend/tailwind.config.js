/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Enable class-based dark mode
  darkMode: 'class', 
  theme: {
    extend: {
      colors: {
        // Corporate Indigo/Purple Palette
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1', // Main Indigo
          600: '#4f46e5',
          700: '#4338ca', // Deep Corporate Purple
          900: '#312e81',
        },
        surface: {
          light: '#ffffff',
          dark: '#1e1e2f', // Premium dark material background
        },
        background: {
          light: '#f3f4f6',
          dark: '#12121c', // Deepest dark for the main app background
        }
      },
      fontFamily: {
        // Material Design standard
        sans: ['Roboto', 'Inter', 'sans-serif'], 
      }
    },
  },
  plugins: [],
}