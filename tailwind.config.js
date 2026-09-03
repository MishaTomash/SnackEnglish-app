import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'hsl(var(--bg-app) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--bg-card) / <alpha-value>)',
          hover: 'hsl(var(--bg-card-hover) / <alpha-value>)',
          border: 'hsl(var(--border-card) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          hover: 'hsl(var(--secondary-hover) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        cookieText: {
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          muted: 'hsl(var(--text-muted) / <alpha-value>)',
        },
      },
      boxShadow: {
        cookie: 'var(--shadow-cookie)',
        'cookie-sm': '0 4px 12px -2px rgba(217, 119, 6, 0.08)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config;