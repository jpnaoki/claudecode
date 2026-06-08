/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Feltro da mesa — clássico, com profundidade
        felt: {
          900: '#072C1E',
          800: '#0A3D2A',
          700: '#0E5236',
          600: '#127A4E',
          500: '#1A9460',
        },
        // Latão / dourado — o toque premium
        brass: {
          300: '#E8D29A',
          400: '#D9BA6B',
          500: '#C9A24B',
          600: '#A9842F',
        },
        // Superfícies creme das cartas e cards
        bone: {
          50: '#FBF7EE',
          100: '#F7F1E3',
          200: '#EFE6D1',
        },
        // Vermelho/preto das cartas
        suit: {
          red: '#B3261E',
          black: '#1C1C1C',
        },
        // Brasa do cigarro / acento lúdico e quente
        ember: {
          400: '#FF8A4C',
          500: '#F2682C',
          600: '#D24E16',
        },
        ink: '#0C1712',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(0,0,0,.18), 0 12px 28px -8px rgba(0,0,0,.45)',
        'card-lift': '0 8px 16px rgba(0,0,0,.25), 0 28px 56px -12px rgba(0,0,0,.55)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.06)',
        glow: '0 0 24px rgba(242,104,44,.55)',
      },
      backgroundImage: {
        'felt-radial':
          'radial-gradient(120% 90% at 50% 0%, #127A4E 0%, #0A3D2A 45%, #072C1E 100%)',
        'brass-line':
          'linear-gradient(90deg, transparent, #C9A24B 20%, #E8D29A 50%, #C9A24B 80%, transparent)',
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(8px) scale(.9)', opacity: '0' },
          '15%': { opacity: '1' },
          '100%': { transform: 'translateY(-48px) scale(1.1)', opacity: '0' },
        },
        smoke: {
          '0%': { transform: 'translateY(0) scaleX(1)', opacity: '0' },
          '20%': { opacity: '.5' },
          '100%': { transform: 'translateY(-60px) scaleX(1.8)', opacity: '0' },
        },
        deal: {
          '0%': { transform: 'translateY(-40px) rotate(-6deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
        },
      },
      animation: {
        'float-up': 'float-up 1.6s ease-out forwards',
        smoke: 'smoke 3s ease-out infinite',
        deal: 'deal .35s ease-out backwards',
      },
    },
  },
  plugins: [],
}
