import { requireAdminMaster } from '@/lib/api/admin-guard';
import { listPorteirosByCondominio } from '@/lib/db/user-management';
import {
  AdminUsersListClient,
  type AdminUserRow,
} from '@/components/admin/AdminUsersListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminFuncionariosPage() {
  const ctx = await requireAdminMaster();
  const porteiros = await listPorteirosByCondominio(ctx.condominioId);

  const rows: AdminUserRow[] = porteiros.map((u) => ({
    id: u.id,
    email: u.email,
    nome: u.nome,
    clerk_id: u.clerk_id,
    ativo: u.ativo,
    created_at: u.created_at.toISOString(),
    ultimo_login: u.ultimo_login ? u.ultimo_login.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <AdminUsersListClient rows={rows} role="porteiro" />
    </div>
  );
}
