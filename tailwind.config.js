/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Owlivion Theme - CSS variable based (dark/light)
        'owl-bg': 'rgb(var(--owl-bg) / <alpha-value>)',
        'owl-surface': 'rgb(var(--owl-surface) / <alpha-value>)',
        'owl-surface-2': 'rgb(var(--owl-surface-2) / <alpha-value>)',
        'owl-border': 'rgb(var(--owl-border) / <alpha-value>)',
        'owl-text': 'rgb(var(--owl-text) / <alpha-value>)',
        'owl-text-secondary': 'rgb(var(--owl-text-secondary) / <alpha-value>)',
        'owl-accent': 'rgb(var(--owl-accent) / <alpha-value>)',
        'owl-accent-hover': 'rgb(var(--owl-accent-hover) / <alpha-value>)',
        'owl-success': 'rgb(var(--owl-success) / <alpha-value>)',
        'owl-warning': 'rgb(var(--owl-warning) / <alpha-value>)',
        'owl-error': 'rgb(var(--owl-error) / <alpha-value>)',
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
