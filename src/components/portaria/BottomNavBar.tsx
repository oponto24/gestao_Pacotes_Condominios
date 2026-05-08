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
  const fabBaseClass =
    'relative -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full shadow-lg transition-all disabled:opacity-60';

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
            className={cn(
              fabBaseClass,
              override.variant === 'success'
                ? 'bg-success text-white hover:bg-success/90'
                : 'animate-pulse bg-primary text-primary-foreground ring-4 ring-primary/40 hover:bg-primary-dark hover:animate-none',
            )}
          >
            {override.icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {override.label}
            </span>
          </button>
        ) : (
          <Link
            href={CHEGADA.href}
            aria-current={chegadaActive ? 'page' : undefined}
            aria-label={CHEGADA.label}
            className={cn(
              fabBaseClass,
              chegadaActive
                ? 'bg-primary-dark text-primary-foreground ring-4 ring-primary/30'
                : 'bg-primary text-primary-foreground hover:bg-primary-dark',
            )}
          >
            {CHEGADA.icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {CHEGADA.label}
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
