/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Teal medical accent
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        navy: {
          800: '#0f172a',
          900: '#0b0f19',
          950: '#060911',
        },
        clinical: {
          emergency: '#ef4444',
          urgent: '#f59e0b',
          routine: '#10b981',
          blue: '#3b82f6',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-teal': '0 0 20px -5px rgba(20, 184, 166, 0.4)',
        'glow-blue': '0 0 20px -5px rgba(59, 130, 246, 0.4)',
      }
    },
  },
  plugins: [],
}
