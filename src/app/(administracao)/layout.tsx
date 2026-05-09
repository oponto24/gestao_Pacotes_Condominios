import { redirect } from 'next/navigation';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { isTenantError } from '@/server/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdministracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Story 10.5: rota /administracao acessível apenas pra admin_master e admin_funcionario.
  // Porteiro e super_admin têm áreas dedicadas.
  try {
    await requireAdminAny();
  } catch (err) {
    if (isTenantError(err)) redirect('/');
    throw err;
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
