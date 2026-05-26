import { UserMenu } from '@/components/admin/UserMenu';
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
  userEmail?: string | null;
  children: React.ReactNode;
}

export function PortariaLayout({
  condominioNome,
  userNome,
  userEmail,
  children,
}: PortariaLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header fixo */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-secondary">
            {condominioNome}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{userNome}</p>
        </div>
        {/* UserMenu compartilhado (achado UX U14): mesmo padrão do /admin,
            /super-admin e /administracao. Inclui avatar, nome, email e Sair. */}
        <UserMenu nome={userNome} email={userEmail} />
      </header>

      {/* Main scrollable — pb-24 deixa espaço pra bottom nav (~56px + folga) */}
      <BottomNavProvider>
        <main className="flex-1 overflow-y-auto px-4 pt-4 md:px-6" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
        <BottomNavBar />
      </BottomNavProvider>
    </div>
  );
}
