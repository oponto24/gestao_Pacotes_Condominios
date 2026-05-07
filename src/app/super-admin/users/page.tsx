import { db } from '@/lib/db';
import { listAllAdmins } from '@/lib/db/user-management';
import { AdminsListClient, type AdminRow } from '@/components/super-admin/AdminsListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guard centralizado em src/app/super-admin/layout.tsx
export default async function SuperAdminUsersPage() {
  const [admins, condominios] = await Promise.all([
    listAllAdmins(),
    db.condominio.findMany({
      where: { ativo: true, deleted_at: null },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  const rows: AdminRow[] = admins.map((a) => ({
    id: a.id,
    email: a.email,
    nome: a.nome,
    condominio_id: a.condominio_id,
    condominio_nome: a.condominio_nome,
    clerk_id: a.clerk_id,
    ativo: a.ativo,
    created_at: a.created_at.toISOString(),
    ultimo_login: a.ultimo_login ? a.ultimo_login.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <AdminsListClient rows={rows} condominios={condominios} />
    </div>
  );
}
