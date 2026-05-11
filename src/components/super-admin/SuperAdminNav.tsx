'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, ScrollText, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const ITEMS: NavItem[] = [
  { href: '/super-admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/super-admin/condominios', label: 'Condomínios', icon: Building2 },
  { href: '/super-admin/users', label: 'Usuários', icon: Users },
  { href: '/super-admin/financas', label: 'Finanças', icon: Wallet },
  { href: '/super-admin/audit', label: 'Audit log', icon: ScrollText },
];

export function SuperAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border bg-background px-4 py-2">
      {ITEMS.map((item) => {
        // /super-admin precisa exact match (raiz não fica ativa em /super-admin/condominios)
        const active =
          item.href === '/super-admin'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-accent/10 text-accent'
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
