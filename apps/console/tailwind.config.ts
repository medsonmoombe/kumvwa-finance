import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF3FD',
          100: '#DCE7FB',
          500: '#2E63E6',
          600: '#1A4FBF',
          900: '#0D2C6E',
        },
        accent: { 50: '#E7F8EF', 500: '#2ECC71', 700: '#1E8F55' },
        ink: { DEFAULT: '#0F1115', 2: '#3A4050', muted: '#7A8194' },
        line: { DEFAULT: '#E7EAF1', 2: '#F0F2F7' },
        surface: '#F5F7FB',
        danger: { 50: '#FDECEC', 500: '#C03538' },
        warn: { 50: '#FDF3E0', 500: '#B26A00' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      borderRadius: { card: '14px', btn: '11px', input: '11px' },
      boxShadow: {
        c1: '0 1px 2px rgba(15,17,21,.05)',
        c2: '0 4px 16px rgba(15,17,21,.07)',
        c3: '0 16px 44px rgba(15,17,21,.14)',
      },
    },
  },
  plugins: [],
} satisfies Config;
