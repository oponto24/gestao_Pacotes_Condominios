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
        // Hierarquia semantica Apple HIG (achado UX U6) — usar nos titulos
        // de pagina/secao em vez de text-2xl/3xl arbitrarios.
        body: ['17px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        subtitle: ['22px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        title: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '600' }],
        display: ['34px', { lineHeight: '40px', letterSpacing: '-0.025em', fontWeight: '700' }],
      },
      spacing: {
        // Alvos de toque mobile (UX_SPEC §2.4)
        'touch-min': '44px',
        'btn-lg': '56px',
        'btn-md': '48px',
        'btn-sm': '40px',
      },
      borderRadius: {
        // Apple HIG (achado UX U7): cantos mais generosos
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        // Apple HIG (achado UX U7): sombra hairline sutil — fica leve em mobile
        apple: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'apple-md': '0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
