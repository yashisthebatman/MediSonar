/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#0D0D0D',
        surfaceLight: '#1A1A1A',
        border: '#262626',
        primary: '#FFFFFF',
        textMain: '#F5F5F5',
        textMuted: '#737373',
      }
    },
  },
  plugins: [],
}
