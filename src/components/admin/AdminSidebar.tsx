'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import {
  ChevronDown,
  ChevronRight,
  FileUp,
  Home,
  Layers,
  LogOut,
  Package,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  storageKey: string;
  items: NavItem[];
}

const TOP_ITEMS: NavItem[] = [
  { href: '/admin/pacotes', label: 'Pacotes', icon: <Package className="h-4 w-4" aria-hidden /> },
];

const CADASTROS: NavGroup = {
  label: 'Cadastros',
  icon: <Layers className="h-4 w-4" aria-hidden />,
  storageKey: 'aiox.adminSidebar.cadastrosOpen',
  items: [
    { href: '/admin/setores', label: 'Setores', icon: <Layers className="h-4 w-4" aria-hidden /> },
    { href: '/admin/unidades', label: 'Unidades', icon: <Home className="h-4 w-4" aria-hidden /> },
    { href: '/admin/moradores', label: 'Moradores', icon: <Users className="h-4 w-4" aria-hidden /> },
    { href: '/admin/cadastros/importar', label: 'Importar CSV', icon: <FileUp className="h-4 w-4" aria-hidden /> },
  ],
};

interface AdminSidebarProps {
  onNavigate?: () => void; // chamado ao clicar em link (mobile fecha drawer)
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  // Sugestão PO: persistir estado do grupo em localStorage
  const [cadastrosOpen, setCadastrosOpen] = useState(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return true;
      const saved = window.localStorage.getItem(CADASTROS.storageKey);
      if (saved === null) return true; // default expandido
      return saved === 'true';
    } catch {
      return true; // localStorage indisponível (jsdom incomplete, private mode)
    }
  });

  function toggleCadastros() {
    setCadastrosOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem(CADASTROS.storageKey, String(next));
      } catch {
        // localStorage indisponível (private mode, etc) — ignora
      }
      return next;
    });
  }

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Navegação admin">
      {TOP_ITEMS.map((item) => (
        <SidebarLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
      ))}

      <button
        type="button"
        onClick={toggleCadastros}
        aria-expanded={cadastrosOpen}
        className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-primary-light/40"
      >
        {CADASTROS.icon}
        <span className="flex-1 text-left">{CADASTROS.label}</span>
        {cadastrosOpen ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
      </button>

      {cadastrosOpen && (
        <div className="ml-2 flex flex-col gap-1 border-l pl-2">
          {CADASTROS.items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
              compact
            />
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <SignOutButton redirectUrl="/">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </SignOutButton>
      </div>
    </nav>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  compact?: boolean;
}

function SidebarLink({ item, active, onNavigate, compact }: SidebarLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        compact ? 'pl-3' : 'font-medium',
        active
          ? 'bg-primary-light text-primary'
          : 'text-foreground hover:bg-primary-light/40',
      )}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}
