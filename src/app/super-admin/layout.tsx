import { redirect } from 'next/navigation';
import { Crown } from 'lucide-react';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { SuperAdminNav } from '@/components/super-admin/SuperAdminNav';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Layout dedicado super-admin (story 8.1).
 * Guard centralizado: só super_admin acessa /super-admin/*.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isSuperAdmin = false;
  try {
    const ctx = await getTenantContext();
    isSuperAdmin = ctx.kind === 'super_admin';
  } catch (err) {
    if (isTenantError(err)) redirect('/');
    throw err;
  }
  if (!isSuperAdmin) redirect('/');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Banner topo: contexto super-admin (escuro pra diferenciar de tenant admin) */}
      <div className="border-b border-brand-ink/30 bg-brand-ink px-4 py-2 text-sm text-white">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-primary" aria-hidden />
          <span className="font-semibold">Super Admin</span>
          <span className="text-white/60">·</span>
          <span className="text-white/80">Ponto 24</span>
        </div>
      </div>
      <SuperAdminNav />
      <main className="flex-1 px-4 py-4 md:px-6">{children}</main>
    </div>
  );
}
