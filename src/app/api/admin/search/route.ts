import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { withTenantContext } from '@/server/db-tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SearchResult {
  type: 'morador' | 'unidade' | 'pacote';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/search' });
  try {
    const ctx = await requireAdminMaster();
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await withTenantContext(ctx, async (tx) => {
      const items: SearchResult[] = [];

      // Search moradores by nome and telefone
      const moradores = await tx.morador.findMany({
        where: {
          ativo: true,
          OR: [
            { nome: { contains: q, mode: 'insensitive' } },
            { telefone: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          nome: true,
          unidade: { select: { identificador: true, bloco: true } },
        },
        take: 5,
      });

      for (const m of moradores) {
        const bloco = m.unidade?.bloco ? `Bloco ${m.unidade.bloco} - ` : '';
        items.push({
          type: 'morador',
          id: m.id,
          title: m.nome,
          subtitle: `${bloco}${m.unidade?.identificador ?? 'Sem unidade'}`,
          href: `/admin/moradores`,
        });
      }

      // Search unidades by identificador
      const unidades = await tx.unidade.findMany({
        where: {
          ativo: true,
          identificador: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          identificador: true,
          bloco: true,
          _count: { select: { moradores: true } },
        },
        take: 5,
      });

      for (const u of unidades) {
        const bloco = u.bloco ? `Bloco ${u.bloco}` : '';
        const count = u._count.moradores;
        const subtitle = [bloco, `${count} morador${count !== 1 ? 'es' : ''}`]
          .filter(Boolean)
          .join(' - ');
        items.push({
          type: 'unidade',
          id: u.id,
          title: u.identificador,
          subtitle,
          href: `/admin/unidades`,
        });
      }

      // Search pacotes by codigo_rastreio
      const pacotes = await tx.pacote.findMany({
        where: {
          codigo_rastreio: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          codigo_rastreio: true,
          status: true,
        },
        take: 5,
      });

      for (const p of pacotes) {
        items.push({
          type: 'pacote',
          id: p.id,
          title: p.codigo_rastreio ?? 'Sem rastreio',
          subtitle: formatStatus(p.status),
          href: `/admin/pacotes/${p.id}`,
        });
      }

      return items.slice(0, 10);
    });

    log.info({ q, count: results.length }, 'busca global');
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err, log);
  }
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    pendente_identificacao: 'Pendente identificacao',
    aguardando_retirada: 'Aguardando retirada',
    retirado: 'Retirado',
    cancelado: 'Cancelado',
  };
  return map[status] ?? status;
}
