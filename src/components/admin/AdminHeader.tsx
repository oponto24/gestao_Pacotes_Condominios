'use client';

import { Building2, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { UserMenu } from './UserMenu';
import { GlobalSearch } from './GlobalSearch';

type RoleLabel = 'admin_master' | 'admin_funcionario' | 'porteiro' | 'super_admin';

interface AdminHeaderProps {
  condominioNome: string;
  condominioCidadeUf: string;
  userNome: string;
  userEmail?: string | null;
  userRole?: RoleLabel;
  onOpenMobileNav: () => void;
}

const ROLE_LABELS: Record<RoleLabel, string> = {
  super_admin: 'Super Admin',
  admin_master: 'Admin Master',
  admin_funcionario: 'Admin Funcionário',
  porteiro: 'Porteiro',
};

export function AdminHeader({
  condominioNome,
  condominioCidadeUf,
  userNome,
  userEmail,
  userRole,
  onOpenMobileNav,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-col border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Abrir menu de navegação"
          className="rounded-md p-2 text-foreground hover:bg-primary-light/40 md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">{condominioNome}</div>
            <div className="text-xs text-text-secondary">{condominioCidadeUf}</div>
          </div>
          <Badge variant="muted" className="ml-2 hidden sm:inline-flex">
            {userRole ? ROLE_LABELS[userRole] : 'Admin'}
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <GlobalSearch />
          <UserMenu nome={userNome} email={userEmail} />
        </div>
      </div>
      <div className="hidden border-t border-border/50 px-4 py-1.5 md:block">
        <Breadcrumbs homeHref="/admin" homeLabel="Início" />
      </div>
    </header>
  );
}
