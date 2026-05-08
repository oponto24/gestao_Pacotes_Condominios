/**
 * Helpers de dashboard `/admin` (Onda 1 — Apple polish).
 *
 * Tenant-scoped: caller já chamou `setTenantContext()`. Aqui só consulta.
 */

import { db } from '@/lib/db';

export interface AdminDashboardStats {
  aguardandoRetirada: number;
  pendenteIdentificacao: number;
  retirados7d: number;
  tempoMedioRetiradaH: number | null;
}

export async function getAdminDashboardStats(condominioId: string): Promise<AdminDashboardStats> {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [aguardando, pendentes, retirados7d, retiradosComTempo] = await Promise.all([
    db.pacote.count({
      where: { condominio_id: condominioId, status: 'aguardando_retirada' },
    }),
    db.pacote.count({
      where: { condominio_id: condominioId, status: 'pendente_identificacao' },
    }),
    db.pacote.count({
      where: {
        condominio_id: condominioId,
        status: 'retirado',
        retirado_em: { gte: seteDiasAtras },
      },
    }),
    db.pacote.findMany({
      where: {
        condominio_id: condominioId,
        status: 'retirado',
        retirado_em: { gte: seteDiasAtras, not: null },
        recebido_em: { not: null },
      },
      select: { recebido_em: true, retirado_em: true },
      take: 200,
    }),
  ]);

  let tempoMedioRetiradaH: number | null = null;
  if (retiradosComTempo.length > 0) {
    const totalMs = retiradosComTempo.reduce((acc, p) => {
      if (!p.retirado_em || !p.recebido_em) return acc;
      return acc + (p.retirado_em.getTime() - p.recebido_em.getTime());
    }, 0);
    const avgMs = totalMs / retiradosComTempo.length;
    tempoMedioRetiradaH = Number((avgMs / (1000 * 60 * 60)).toFixed(1));
  }

  return { aguardandoRetirada: aguardando, pendenteIdentificacao: pendentes, retirados7d, tempoMedioRetiradaH };
}

export interface AdminRecentPacote {
  id: string;
  status: string;
  created_at: Date;
  morador_nome: string | null;
  unidade_label: string | null;
}

export async function getAdminRecentPacotes(
  condominioId: string,
  limit = 8,
): Promise<AdminRecentPacote[]> {
  const items = await db.pacote.findMany({
    where: { condominio_id: condominioId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      created_at: true,
      destinatario: { select: { nome: true } },
      unidade: { select: { identificador: true, bloco: true } },
    },
  });

  return items.map((p) => ({
    id: p.id,
    status: p.status,
    created_at: p.created_at,
    morador_nome: p.destinatario?.nome ?? null,
    unidade_label: p.unidade
      ? `${p.unidade.bloco ? p.unidade.bloco + ' · ' : ''}${p.unidade.identificador}`
      : null,
  }));
}
