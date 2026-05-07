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
        // Tokens shadcn (mapeados pra CSS vars em globals.css) — usados por
        // componentes ui/* (sheet, input, badge etc). Sem isso, classes como
        // bg-background ficam vazias e overlays/painéis ficam transparentes.
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Texto secundário (descrições, placeholders, labels muted)
        'text-secondary': '#6B7280',
        // Brand Ponto 24 (story 3.11)
        primary: {
          DEFAULT: '#FDC800', // amarelo Ponto24
          dark: '#E5B400', // hover/active
          light: '#FFF4CC',
          foreground: '#1A1A1A', // texto preto pra contraste AAA em amarelo
        },
        // Accent — violet Ponto24 (badges secundários, indicadores IA)
        accent: {
          DEFAULT: '#7C3AED',
          dark: '#6D28D9',
          light: '#EDE9FE',
          foreground: '#FFFFFF',
        },
        // Brand neutros (texto, cinzas)
        brand: {
          ink: '#1A1A1A', // texto principal escuro
          mid: '#6B7280', // texto secundário
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
        sans: ['var(--font-sans)', 'Montserrat', 'system-ui', 'sans-serif'],
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
