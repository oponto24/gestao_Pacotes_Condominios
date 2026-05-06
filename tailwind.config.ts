import type { Config } from 'tailwindcss';

/**
 * Tokens iniciais derivados de docs/ux/UX_SPEC.md §2.
 * Mantenha em sincronia quando UX evoluir.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#DBEAFE',
        },
        // Semantic
        success: { DEFAULT: '#16A34A', light: '#DCFCE7' },
        warning: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', light: '#FEE2E2' },
        info: '#0EA5E9',
        // Surfaces
        surface: '#F9FAFB',
        // Status do pacote (UX_SPEC §2.1)
        status: {
          rascunho: '#6B7280',
          'pendente-id': '#F59E0B',
          aguardando: '#0EA5E9',
          retirado: '#16A34A',
          cancelado: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // base 16px enforced (legibilidade mobile)
        base: ['16px', { lineHeight: '24px' }],
      },
      spacing: {
        // Alvos de toque mobile (UX_SPEC §2.4)
        'touch-min': '44px',
        'btn-lg': '56px',
        'btn-md': '48px',
        'btn-sm': '40px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
