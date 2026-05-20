'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  DoorOpen,
  FileUp,
  LayoutDashboard,
  Layers,
  Package,
  ScrollText,
  ShieldCheck,
  UserCheck,
  UserCog,
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
  { href: '/admin', label: 'Início', icon: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
  { href: '/admin/pacotes', label: 'Pacotes', icon: <Package className="h-4 w-4" aria-hidden /> },
  { href: '/admin/audit', label: 'Audit log', icon: <ScrollText className="h-4 w-4" aria-hidden /> },
];

const EQUIPE: NavGroup = {
  label: 'Equipe',
  icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
  storageKey: 'aiox.adminSidebar.equipeOpen',
  items: [
    { href: '/admin/equipe', label: 'Admins', icon: <UserCheck className="h-4 w-4" aria-hidden /> },
    { href: '/admin/funcionarios', label: 'Porteiros', icon: <UserCog className="h-4 w-4" aria-hidden /> },
  ],
};

const CADASTROS: NavGroup = {
  label: 'Cadastros',
  icon: <Layers className="h-4 w-4" aria-hidden />,
  storageKey: 'aiox.adminSidebar.cadastrosOpen',
  items: [
    { href: '/admin/setores', label: 'Setores', icon: <Layers className="h-4 w-4" aria-hidden /> },
    { href: '/admin/blocos', label: 'Torres/Blocos', icon: <Building2 className="h-4 w-4" aria-hidden /> },
    { href: '/admin/unidades', label: 'Unidades', icon: <DoorOpen className="h-4 w-4" aria-hidden /> },
    { href: '/admin/moradores', label: 'Moradores', icon: <Users className="h-4 w-4" aria-hidden /> },
    { href: '/admin/cadastros/importar', label: 'Importar CSV', icon: <FileUp className="h-4 w-4" aria-hidden /> },
  ],
};

interface AdminSidebarProps {
  onNavigate?: () => void; // chamado ao clicar em link (mobile fecha drawer)
}

function readGroupOpen(storageKey: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

function persistGroupOpen(storageKey: string, value: boolean): boolean {
  try {
    window.localStorage?.setItem(storageKey, String(value));
  } catch {
    /* localStorage indisponível */
  }
  return value;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  // Sugestão PO: persistir estado do grupo em localStorage
  const [cadastrosOpen, setCadastrosOpen] = useState(() => readGroupOpen(CADASTROS.storageKey));
  const [equipeOpen, setEquipeOpen] = useState(() => readGroupOpen(EQUIPE.storageKey));

  function toggleCadastros() {
    setCadastrosOpen((prev) => persistGroupOpen(CADASTROS.storageKey, !prev));
  }
  function toggleEquipe() {
    setEquipeOpen((prev) => persistGroupOpen(EQUIPE.storageKey, !prev));
  }

  function isActive(href: string, exact = false): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Navegação admin">
      {TOP_ITEMS.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          // /admin precisa ser exact: outras rotas /admin/* não ficam ativas no Início
          active={isActive(item.href, item.href === '/admin')}
          onNavigate={onNavigate}
        />
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

      <button
        type="button"
        onClick={toggleEquipe}
        aria-expanded={equipeOpen}
        className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-primary-light/40"
      >
        {EQUIPE.icon}
        <span className="flex-1 text-left">{EQUIPE.label}</span>
        {equipeOpen ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
      </button>

      {equipeOpen && (
        <div className="ml-2 flex flex-col gap-1 border-l pl-2">
          {EQUIPE.items.map((item) => (
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

      {/* Logout consolidado no UserMenu do AdminHeader (achado U2). */}
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
