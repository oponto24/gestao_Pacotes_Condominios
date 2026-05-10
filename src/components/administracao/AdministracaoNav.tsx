'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const ITEMS: NavItem[] = [
  { href: '/administracao/organizar', label: 'Organizar', icon: Layers },
  { href: '/administracao/em-transito', label: 'Em trânsito', icon: Truck },
];

export function AdministracaoNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border bg-background px-4 py-2 md:px-6">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-light/40 text-foreground'
                : 'text-text-secondary hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
