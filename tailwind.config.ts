import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F9F9F9',
        sidebar: '#1E1E2E',
        accent: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
        },
        estado: {
          abierto: '#6B7280',
          gestion: '#2563EB',
          espera: '#D97706',
          cerrado: '#059669',
          escalado: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
}

export default config
