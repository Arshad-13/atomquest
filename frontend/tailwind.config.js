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
        slate: {
          50: '#f3f5f9', // Numerro Light Canvas
          100: '#e9ecf3',
          200: '#dbe0ec', // Light Border
          350: '#8c9cb8',
          400: '#7887b8', // Muted Text
          450: '#5c6b9c',
          500: '#505f98',
          600: '#3b4775',
          750: '#212844',
          800: '#1d243e', // Dark Border
          900: '#121625', // Dark Card Surface
          950: '#0c0f19', // Dark Canvas
        },
        gray: {
          50: '#f3f5f9',
          100: '#e9ecf3',
          150: '#dbe0ec',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#7887b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1d243e',
          900: '#121625',
          950: '#0c0f19',
        },
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
          dark: '#121625', // Numerro Dashboard Surface
        },
        background: {
          light: '#f3f5f9', // Numerro Light Canvas
          dark: '#0c0f19', // Numerro Signature Dark Canvas
        },
        glass: {
          dark: 'rgba(18, 22, 37, 0.8)',
          border: 'rgba(255, 255, 255, 0.06)',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Roboto', 'Inter', 'sans-serif'], 
        heading: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
