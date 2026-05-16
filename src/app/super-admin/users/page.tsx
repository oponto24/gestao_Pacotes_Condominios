import { db } from '@/lib/db';
import { listAllUsers } from '@/lib/db/user-management';
import { userListQuerySchema } from '@/lib/validators/user-create';
import { UsersListClient, type UserRow } from '@/components/super-admin/UsersListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Guard centralizado em src/app/super-admin/layout.tsx
export default async function SuperAdminUsersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
  }
  const query = userListQuerySchema.parse(flat);

  const [result, condominios] = await Promise.all([
    listAllUsers({
      page: query.page,
      pageSize: query.pageSize,
      role: query.role,
      condominioId: query.condominio_id,
      status: query.status,
      q: query.q,
    }),
    db.condominio.findMany({
      where: { ativo: true, deleted_at: null },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  const rows: UserRow[] = result.items.map((u) => ({
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    condominio_id: u.condominio_id,
    condominio: u.condominio,
    clerk_id: u.clerk_id,
    ativo: u.ativo,
    created_at: u.created_at.toISOString(),
    ultimo_login: u.ultimo_login ? u.ultimo_login.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <UsersListClient
        rows={rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        condominios={condominios}
      />
    </div>
  );
}
