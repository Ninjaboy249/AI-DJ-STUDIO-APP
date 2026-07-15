/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── DJ Pad palette — orange glow on matte black ──
        bg:          '#0a0b0d',
        panel:       '#111318',
        surface:     '#161a20',
        border:      '#1e2330',
        accent:      '#ff8c00',
        'accent-dim':'#b85e00',
        chrome:      '#2a2e38',
        text:        '#f0e8d8',
        muted:       '#7a7060',
      },
      boxShadow: {
        'accent':     '0 0 8px rgba(255,140,0,0.45)',
        'accent-lg':  '0 0 18px rgba(255,140,0,0.45)',
        'accent-xl':  '0 0 28px rgba(255,140,0,0.45)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
