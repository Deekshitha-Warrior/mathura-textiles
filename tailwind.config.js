/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#F9FAFB', // Clean light slate canvas
        cardBg:    '#FFFFFF', // Crisp white card
        'brand-blue': {
          DEFAULT: '#111111', // Primary black
          nav:     '#111111',
          primary: '#111111',
          hover:   '#262626', // Charcoal
          light:   '#F9FAFB',
          surface: '#F3F4F6',
        },
        'brand-gold': {
          DEFAULT: '#D4AF37', // Rich Yellow Gold
          rich:    '#D4AF37',
          hover:   '#C89B27',
          deep:    '#B38018', // Deep Metallic Gold (Text & Borders)
          glow:    '#FFF8E7', // Soft Gold Highlight / Glow
        },
        brand: {
          blue:       '#111111',
          blueHover:  '#262626',
          blueLight:  '#F9FAFB',
          gold:       '#D4AF37',
          goldHover:  '#C89B27',
          goldDeep:   '#B38018',
          goldLight:  '#FFF8E7',
          goldBorder: '#F3F4F6',
          black:      '#111111', // Primary black
          dark:       '#000000',
        },
        gold: {
          DEFAULT: '#D4AF37',
          dark:    '#B38018',
          light:   '#FFF8E7',
          border:  '#E8D399',
        },
        maroon: {
          DEFAULT: '#111111',
          dark:    '#000000',
          light:   '#F9FAFB',
        },
        textMain:  '#1F1F1F', // Slate 900
        textMuted: '#6B7280', // Slate 600
        borderLight: '#F3F4F6', // Card borders with subtle slate/gold
      },
      fontFamily: {
        sans:      ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'system-ui', '-apple-system', 'sans-serif'],
        dmsans:    ['"DM Sans"', 'sans-serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
        outfit:    ['"Outfit"', 'sans-serif'],
        brand:     ['"Cinzel"', '"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'serif'],
        headline:  ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 1px 3px rgba(0,0,0,0.05)',
        gold:   '0 4px 20px -2px rgba(212, 175, 55, 0.25)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '10px',
        'input': '10px',
        'table': '12px',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
