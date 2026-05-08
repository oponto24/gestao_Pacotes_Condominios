import { SignOutButton } from '@clerk/nextjs';
import { LogOut } from 'lucide-react';
import { BottomNavBar } from './BottomNavBar';
import { BottomNavProvider } from './BottomNavContext';

/**
 * Template da portaria (story 3.1).
 *
 * Mobile-first absoluto: header fixo + main scrollable + bottom nav fixo.
 * Sem sidebar. Touch targets ≥44px. Labels sempre visíveis.
 *
 * Recebe props server-side do `(portaria)/layout.tsx`.
 */

interface PortariaLayoutProps {
  condominioNome: string;
  userNome: string;
  children: React.ReactNode;
}

function getIniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'P';
}

export function PortariaLayout({ condominioNome, userNome, children }: PortariaLayoutProps) {
  const iniciais = getIniciais(userNome);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header fixo */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wide text-text-secondary">
            {condominioNome}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{userNome}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
          >
            {iniciais}
          </span>
          <SignOutButton>
            <button
              type="button"
              aria-label="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </SignOutButton>
        </div>
      </header>

      {/* Main scrollable — pb-24 deixa espaço pra bottom nav (~56px + folga) */}
      <BottomNavProvider>
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-6">{children}</main>
        <BottomNavBar />
      </BottomNavProvider>
    </div>
  );
}
