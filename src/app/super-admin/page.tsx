import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  Package,
  ScrollText,
  Users,
  ShieldCheck,
  Briefcase,
  KeyRound,
} from 'lucide-react';
import {
  getSuperAdminStats,
  getRecentCondominios,
  getRecentAuditEntries,
} from '@/lib/db/dashboard-super-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guard centralizado no layout super-admin
export default async function SuperAdminDashboardPage() {
  const [stats, conds, audit] = await Promise.all([
    getSuperAdminStats(),
    getRecentCondominios(5),
    getRecentAuditEntries(5),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Visão geral da plataforma</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Saúde do Ponto 24 e atalhos administrativos
        </p>
      </header>

      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Indicadores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            href="/super-admin/condominios"
            icon={<Building2 className="size-5" aria-hidden />}
            label="Condomínios ativos"
            value={stats.condominiosAtivos}
            tone="default"
          />
          <KpiCard
            href="/super-admin/users"
            icon={<Users className="size-5" aria-hidden />}
            label="Usuários ativos"
            value={stats.usersTotal}
            tone="default"
          />
          <KpiCard
            href="/super-admin/audit"
            icon={<Package className="size-5" aria-hidden />}
            label="Pacotes (24h)"
            value={stats.pacotes24h}
            tone="success"
          />
          <KpiCard
            href="/super-admin/audit"
            icon={<AlertTriangle className="size-5" aria-hidden />}
            label="Pendentes (global)"
            value={stats.pendentesGlobal}
            tone={stats.pendentesGlobal > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Story 12.1 (Epic 12 / FR-120): breakdown por role */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <KpiCard
            href="/super-admin/users?role=admin_master"
            icon={<ShieldCheck className="size-5" aria-hidden />}
            label="Admins master (síndicos)"
            value={stats.adminMastersAtivos}
            tone="default"
          />
          <KpiCard
            href="/super-admin/users?role=admin_funcionario"
            icon={<Briefcase className="size-5" aria-hidden />}
            label="Admins funcionários"
            value={stats.adminFuncionariosAtivos}
            tone="default"
          />
          <KpiCard
            href="/super-admin/users?role=porteiro"
            icon={<KeyRound className="size-5" aria-hidden />}
            label="Porteiros"
            value={stats.porteirosAtivos}
            tone="default"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="conds-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2
              id="conds-heading"
              className="text-sm font-semibold uppercase tracking-wide text-text-secondary"
            >
              Condomínios recentes
            </h2>
            <Link
              href="/super-admin/condominios"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              Ver todos →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            {conds.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-secondary">Nenhum condomínio cadastrado ainda.</p>
                <Link
                  href="/super-admin/condominios"
                  className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Cadastrar primeiro condomínio →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conds.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-text-secondary">
                        {c.cidade}/{c.estado} · {timeAgo(c.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="audit-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2
              id="audit-heading"
              className="text-sm font-semibold uppercase tracking-wide text-text-secondary"
            >
              Eventos recentes
            </h2>
            <Link
              href="/super-admin/audit"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              Ver audit log →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            {audit.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-secondary">Nenhum evento registrado.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 px-4 py-3">
                    <ScrollText
                      className="mt-0.5 size-4 shrink-0 text-text-secondary"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{e.acao}</div>
                      <div className="text-xs text-text-secondary">
                        {e.user_email ?? 'sistema'} · {timeAgo(e.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  href,
  icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : tone === 'success'
        ? 'border-success/30 bg-success/5'
        : 'border-border bg-background';
  return (
    <Link
      href={href}
      className={`group block rounded-lg border p-4 transition-all hover:border-primary hover:shadow-sm ${toneClass}`}
    >
      <span className="text-text-secondary group-hover:text-primary">{icon}</span>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-text-secondary">{label}</div>
    </Link>
  );
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
