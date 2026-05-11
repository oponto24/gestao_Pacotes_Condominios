'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Camera, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBottomNav } from './BottomNavContext';

/**
 * Bottom nav fixa da portaria (story 3.1 + Onda 1 polish).
 *
 * Layout: 2 abas laterais (Pendentes · Retirada) + FAB central elevado pra Chegada
 * (ação primária do porteiro). Touch ≥56px, FAB ≥64px (NFR-050).
 *
 * Mantém os mesmos 3 links — só muda o destaque visual da Chegada.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: 'exact' | 'prefix';
}

const PENDENTES: NavItem = {
  href: '/portaria/pendentes',
  label: 'Pendentes',
  icon: <AlertCircle className="h-5 w-5" aria-hidden />,
  match: 'prefix',
};

const RETIRADA: NavItem = {
  href: '/retirada',
  label: 'Retirada',
  icon: <QrCode className="h-5 w-5" aria-hidden />,
  match: 'prefix',
};

const CHEGADA: NavItem = {
  href: '/chegada',
  label: 'Chegada',
  icon: <Camera className="h-7 w-7" aria-hidden />,
  match: 'prefix',
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNavBar() {
  const pathname = usePathname() ?? '';
  const chegadaActive = isActive(pathname, CHEGADA);
  const pendentesActive = isActive(pathname, PENDENTES);
  const retiradaActive = isActive(pathname, RETIRADA);
  const { override } = useBottomNav();

  // FAB central — quando override está setado por uma página (ex: CapturaPage
  // após captura de foto), vira botão de ação contextual em vez de link.
  //
  // Visual (PR-2 redesign): gradiente vertical OKLCH + glow shadow + hairline
  // interna branca pra sensação táctil. Tokens em globals.css.
  const fabBaseClass =
    'relative -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full ' +
    'transition-[background,box-shadow,transform] duration-300 ease-out ' +
    'shadow-[0_8px_24px_-4px_var(--fab-glow)] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-full ' +
    "before:bg-[linear-gradient(180deg,oklch(1_0_0/0.25),oklch(1_0_0/0)_45%)] before:content-['']" +
    ' disabled:opacity-60';

  // Gradient backgrounds via inline style — Tailwind arbitrary values com
  // var(--token) funcionam, mas inline mantém o source da paleta legível.
  const fabDefaultStyle = {
    backgroundImage:
      'linear-gradient(180deg, var(--fab-default-from), var(--fab-default-to))',
  } as const;
  const fabSuccessStyle = {
    backgroundImage:
      'linear-gradient(180deg, var(--fab-success-from), var(--fab-success-to))',
    boxShadow: '0 10px 28px -4px var(--fab-glow-success)',
  } as const;
  // Variante "active" (em /chegada sem override) — gradiente um pouco mais
  // intenso pra sinalizar "você está aqui, a ação primária é esta".
  const fabActiveStyle = {
    backgroundImage:
      'linear-gradient(180deg, var(--fab-action-from), var(--fab-action-to))',
    boxShadow: '0 10px 28px -4px var(--fab-glow)',
  } as const;

  return (
    <nav
      role="navigation"
      aria-label="Navegação portaria"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background"
    >
      <div className="relative mx-auto flex max-w-screen-md items-end justify-around">
        <SideTab item={PENDENTES} active={pendentesActive} />

        {override ? (
          <button
            type="button"
            onClick={override.onClick}
            disabled={override.disabled}
            aria-label={override.ariaLabel ?? override.label}
            aria-busy={override.disabled || undefined}
            className={cn(fabBaseClass, 'text-white')}
            style={
              override.variant === 'success' ? fabSuccessStyle : fabDefaultStyle
            }
          >
            <span className="relative z-[1] flex flex-col items-center gap-0.5">
              {override.icon}
              <span className="text-[11px] font-semibold tracking-wide">
                {override.label}
              </span>
            </span>
          </button>
        ) : (
          <Link
            href={CHEGADA.href}
            aria-current={chegadaActive ? 'page' : undefined}
            aria-label={CHEGADA.label}
            className={cn(fabBaseClass, 'text-white')}
            style={chegadaActive ? fabActiveStyle : fabDefaultStyle}
          >
            <span className="relative z-[1] flex flex-col items-center gap-0.5">
              {CHEGADA.icon}
              <span className="text-[11px] font-semibold tracking-wide">
                {CHEGADA.label}
              </span>
            </span>
          </Link>
        )}

        <SideTab item={RETIRADA} active={retiradaActive} />
      </div>
    </nav>
  );
}

function SideTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors',
        active ? 'text-primary' : 'text-text-secondary hover:text-foreground',
      )}
    >
      <span className={cn(active && 'scale-110 transition-transform')}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}
