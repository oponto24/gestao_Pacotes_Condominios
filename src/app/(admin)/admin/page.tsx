import Link from 'next/link';
import { AlertTriangle, Clock, FileUp, Package, ShieldCheck, UserPlus } from 'lucide-react';
import { db } from '@/lib/db';
import { getTenantContext } from '@/server/middleware/tenant';
import { getAdminDashboardStats, getAdminRecentPacotes } from '@/lib/db/dashboard-admin';
import { PacoteStatusBadge } from '@/components/admin/PacoteStatusBadge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboardPage() {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant') return null;

  const [user, condominio, stats, recentes] = await Promise.all([
    db.user.findUnique({ where: { id: ctx.userId }, select: { nome: true } }),
    db.condominio.findUnique({
      where: { id: ctx.condominioId },
      select: { nome: true, _count: { select: { unidades: true, moradores: true } } },
    }),
    getAdminDashboardStats(ctx.condominioId),
    getAdminRecentPacotes(ctx.condominioId, 8),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {user?.nome?.split(' ')[0] ?? 'Admin'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {condominio?.nome} · {condominio?._count.unidades} unidades · {condominio?._count.moradores}{' '}
          moradores
        </p>
      </header>

      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Indicadores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            href="/admin/pacotes?status=aguardando_retirada"
            icon={<Package className="size-5" aria-hidden />}
            label="Aguardando retirada"
            value={stats.aguardandoRetirada}
            tone="default"
          />
          <KpiCard
            href="/admin/pacotes?status=pendente_identificacao"
            icon={<AlertTriangle className="size-5" aria-hidden />}
            label="Pendentes de identificação"
            value={stats.pendenteIdentificacao}
            tone={stats.pendenteIdentificacao > 0 ? 'warning' : 'default'}
          />
          <KpiCard
            href="/admin/pacotes?status=retirado"
            icon={<ShieldCheck className="size-5" aria-hidden />}
            label="Retirados (7 dias)"
            value={stats.retirados7d}
            tone="success"
          />
          <KpiCard
            href="/admin/pacotes"
            icon={<Clock className="size-5" aria-hidden />}
            label="Tempo médio de retirada"
            value={stats.tempoMedioRetiradaH !== null ? `${stats.tempoMedioRetiradaH}h` : '—'}
            tone="default"
          />
        </div>
      </section>

      <section aria-labelledby="atalhos-heading">
        <h2 id="atalhos-heading" className="text-base font-semibold text-text-secondary">
          Atalhos
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ShortcutCard
            href="/admin/cadastros/importar"
            icon={<FileUp className="size-5" aria-hidden />}
            title="Importar moradores via CSV"
            description="Cadastro em massa do condomínio"
          />
          <ShortcutCard
            href="/admin/moradores"
            icon={<UserPlus className="size-5" aria-hidden />}
            title="Cadastrar morador"
            description="Adicionar morador individual"
          />
          <ShortcutCard
            href="/admin/equipe"
            icon={<ShieldCheck className="size-5" aria-hidden />}
            title="Convidar admin/porteiro"
            description="Equipe que opera o sistema"
          />
        </div>
      </section>

      <section aria-labelledby="recentes-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="recentes-heading" className="text-base font-semibold text-text-secondary">
            Atividade recente
          </h2>
          <Link
            href="/admin/pacotes"
            className="text-sm font-medium text-primary hover:text-primary-dark"
          >
            Ver todos →
          </Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
          {recentes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-secondary">Nenhum pacote registrado ainda.</p>
              <Link
                href="/chegada"
                className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary-dark"
              >
                Ir pra captura na portaria →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/pacotes/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.morador_nome ?? 'Destinatário não identificado'}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {p.unidade_label ?? 'sem unidade'} ·{' '}
                        {timeAgo(p.created_at)}
                      </div>
                    </div>
                    <PacoteStatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
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
      <div className="flex items-center justify-between">
        <span className="text-text-secondary group-hover:text-primary">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-text-secondary">{label}</div>
    </Link>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
    >
      <span className="rounded-md bg-primary-light p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{description}</div>
      </div>
    </Link>
  );
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}
