import { db } from '@/lib/db';
import { getTenantContext } from '@/server/middleware/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboardPage() {
  // Layout já garante que ctx é tenant + admin
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant') return null;

  const [user, condominio] = await Promise.all([
    db.user.findUnique({ where: { id: ctx.userId }, select: { nome: true } }),
    db.condominio.findUnique({
      where: { id: ctx.condominioId },
      select: { nome: true, _count: { select: { unidades: true, moradores: true, pacotes: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Bem-vindo, {user?.nome ?? 'Admin'}!
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Você está em <strong>{condominio?.nome}</strong>. Use o menu lateral para acessar
          Pacotes ou Cadastros.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unidades" value={condominio?._count.unidades ?? 0} />
        <StatCard label="Moradores" value={condominio?._count.moradores ?? 0} />
        <StatCard label="Pacotes" value={condominio?._count.pacotes ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
