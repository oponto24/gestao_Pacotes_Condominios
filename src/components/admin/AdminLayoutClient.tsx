'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutClientProps {
  condominioNome: string;
  condominioCidadeUf: string;
  userNome: string;
  userEmail?: string | null;
  children: React.ReactNode;
}

export function AdminLayoutClient({
  condominioNome,
  condominioCidadeUf,
  userNome,
  userEmail,
  children,
}: AdminLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar fixa (desktop md+) */}
      <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
        <AdminSidebar />
      </aside>

      {/* Drawer mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <AdminSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          condominioNome={condominioNome}
          condominioCidadeUf={condominioCidadeUf}
          userNome={userNome}
          userEmail={userEmail}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
