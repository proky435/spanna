/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // sötét/világos mód .dark osztállyal
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9ecff',
          200: '#bcdcff',
          300: '#8ec5ff',
          400: '#59a6ff',
          500: '#3385ff',
          600: '#1f66f5',
          700: '#1a51e1',
          800: '#1c43b6',
          900: '#1d3d8f',
        },
      },
      boxShadow: {
        'card':       '0 2px 8px -2px rgba(15,23,42,.08), 0 1px 2px -1px rgba(15,23,42,.04)',
        'card-hover': '0 8px 24px -4px rgba(15,23,42,.12), 0 2px 6px -1px rgba(15,23,42,.06)',
        'glow-brand': '0 8px 24px -6px rgba(31,102,245,.45)',
        'glow-emerald': '0 8px 24px -6px rgba(16,185,129,.45)',
        'inner-soft': 'inset 0 1px 0 0 rgba(255,255,255,.06)',
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'pop':      { '0%': { transform: 'scale(.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
        'shake':    { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        'slide-in': { '0%': { opacity: 0, transform: 'translateX(24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.94)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-in':  'fade-in .25s ease-out',
        'pop':      'pop .25s ease-out',
        'shake':    'shake .35s ease-in-out',
        'slide-in': 'slide-in .25s ease-out',
        'scale-in': 'scale-in .2s ease-out',
      },
    },
  },
  plugins: [],
};
