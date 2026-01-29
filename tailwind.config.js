/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Owlivion Dark Theme
        'owl-bg': '#0a0a0f',
        'owl-surface': '#12121a',
        'owl-surface-2': '#1a1a24',
        'owl-border': '#2a2a3a',
        'owl-text': '#e4e4e7',
        'owl-text-secondary': '#71717a',
        'owl-accent': '#8b5cf6',
        'owl-accent-hover': '#7c3aed',
        'owl-success': '#22c55e',
        'owl-warning': '#f59e0b',
        'owl-error': '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'owl': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'owl-lg': '0 8px 40px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
