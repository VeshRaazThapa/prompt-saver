import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#0D9488',
          hover: '#0F766E',
          light: '#CCFBF1',
          dark: '#042F2E',
        },
        surface: '#FFFFFF',
        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
