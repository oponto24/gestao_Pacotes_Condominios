'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Package, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom nav fixa da portaria (story 3.1).
 *
 * 3 abas: Chegada (/chegada), Pendentes (/portaria/pendentes), Retirada (/retirada).
 * Mobile-first absoluto (NFR-050): labels SEMPRE visíveis, touch ≥44px,
 * sem icon-only.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Match exato ou prefixo. */
  match: 'exact' | 'prefix';
}

const ITEMS: NavItem[] = [
  {
    href: '/chegada',
    label: 'Chegada',
    icon: <Package className="h-5 w-5" aria-hidden />,
    match: 'prefix',
  },
  {
    href: '/portaria/pendentes',
    label: 'Pendentes',
    icon: <AlertCircle className="h-5 w-5" aria-hidden />,
    match: 'prefix',
  },
  {
    href: '/retirada',
    label: 'Retirada',
    icon: <QrCode className="h-5 w-5" aria-hidden />,
    match: 'prefix',
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNavBar() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      role="navigation"
      aria-label="Navegação portaria"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background"
    >
      <ul className="mx-auto flex max-w-screen-md">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-foreground',
                )}
              >
                <span className={cn(active && 'scale-110 transition-transform')}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
