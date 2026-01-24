/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Obsidian palette
        'obsidian': {
          950: '#05070A',
          900: '#0B0F17',
          800: '#111827',
          700: '#1E293B',
        },
        'accent-geopo': '#f43f5e',
        'accent-eco': '#0ea5e9',
        'accent-politique': '#8b5cf6',
      },
      boxShadow: {
        'glow-geopo': '0 0 20px rgba(244, 63, 94, 0.3)',
        'glow-eco': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-politique': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-geopo-sm': '0 0 10px rgba(244, 63, 94, 0.4)',
        'glow-eco-sm': '0 0 10px rgba(14, 165, 233, 0.4)',
        'glow-politique-sm': '0 0 10px rgba(139, 92, 246, 0.4)',
      },
      letterSpacing: {
        'editorial': '-0.02em',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
