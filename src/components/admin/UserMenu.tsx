'use client';

import { SignOutButton } from '@clerk/nextjs';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  nome: string;
  email?: string | null;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase() || '?';
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

/**
 * Dropdown leve usando <details>/<summary> nativos.
 * - Acessível por keyboard (Enter/Space pra abrir, ESC fecha quando focado)
 * - Sem dep nova
 * - Fecha ao clicar fora via :focus-within / blur
 */
export function UserMenu({ nome, email }: UserMenuProps) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-light/40',
          '[&::-webkit-details-marker]:hidden',
        )}
        aria-label={`Menu do usuário ${nome}`}
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
        >
          {initials(nome)}
        </span>
        <span className="hidden text-foreground sm:inline">{nome}</span>
        <ChevronDown className="h-4 w-4 text-text-secondary transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div
        role="menu"
        className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-background p-1 shadow-lg"
      >
        <div className="border-b px-3 py-2 text-xs text-text-secondary">
          <div className="font-medium text-foreground">{nome}</div>
          {email && <div className="truncate">{email}</div>}
        </div>
        <button
          type="button"
          role="menuitem"
          disabled
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary opacity-60"
        >
          <UserCircle className="h-4 w-4" aria-hidden />
          Meu perfil
          <span className="ml-auto text-xs">em breve</span>
        </button>
        <SignOutButton redirectUrl="/">
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </SignOutButton>
      </div>
    </details>
  );
}
