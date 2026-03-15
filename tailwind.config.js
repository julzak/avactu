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
        'accent-monde': '#f59e0b',
      },
      boxShadow: {
        'glow-geopo': '0 0 20px rgba(244, 63, 94, 0.3)',
        'glow-monde': '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-geopo-sm': '0 0 10px rgba(244, 63, 94, 0.4)',
        'glow-monde-sm': '0 0 10px rgba(245, 158, 11, 0.4)',
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
