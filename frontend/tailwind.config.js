/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens do Lynk — ver docs/decisoes.md
        base: '#050B1F',
        surface: '#0B1836',
        'surface-2': '#0F1E42',
        border: '#1E2A4A',
        text: {
          primary: '#E9F2FF',
          secondary: '#8DA1C8',
          muted: '#5C6E92',
        },
        brand: {
          cyan: '#00CBFF',
          blue: '#0079FF',
          orange: '#FF8900',
        },
        state: {
          success: '#22C55E',
          warning: '#F5A524',
          danger: '#EF4444',
        },
      },
      borderRadius: {
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(0,203,255,0.4), 0 8px 32px rgba(0,121,255,0.25)',
      },
    },
  },
  plugins: [],
};
