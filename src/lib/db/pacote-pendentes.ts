/**
 * Lista pacotes em status `pendente_identificacao` do tenant (story 3.10).
 *
 * Usada na tela `/portaria/pendentes` pra porteiro ver o que falta resolver.
 */

import { withTenantContext } from '@/server/db-tenant';

export interface PendenteCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
}

export interface PendenteListItem {
  id: string;
  recebido_em: Date | null;
  nome_destinatario_etiqueta: string | null;
  complemento_etiqueta: string | null;
  cep_etiqueta: string | null;
  ia_confianca: number | null;
  foto_storage_path: string | null;
}

export async function listPendentes(
  ctx: PendenteCtx,
  limit = 100,
): Promise<PendenteListItem[]> {
  return withTenantContext(ctx, async (tx) => {
    const pacotes = await tx.pacote.findMany({
      where: { status: 'pendente_identificacao' },
      select: {
        id: true,
        recebido_em: true,
        nome_destinatario_etiqueta: true,
        complemento_etiqueta: true,
        cep_etiqueta: true,
        ia_confianca: true,
      },
      orderBy: { recebido_em: 'asc' },
      take: limit,
    });

    if (pacotes.length === 0) return [];

    const fotos = await tx.pacoteFoto.findMany({
      where: {
        pacote_id: { in: pacotes.map((p) => p.id) },
        is_principal: true,
      },
      select: { pacote_id: true, storage_path: true },
    });
    const fotoMap = new Map(fotos.map((f) => [f.pacote_id, f.storage_path]));

    return pacotes.map((p) => ({
      id: p.id,
      recebido_em: p.recebido_em,
      nome_destinatario_etiqueta: p.nome_destinatario_etiqueta,
      complemento_etiqueta: p.complemento_etiqueta,
      cep_etiqueta: p.cep_etiqueta,
      ia_confianca: p.ia_confianca ? Number(p.ia_confianca) : null,
      foto_storage_path: fotoMap.get(p.id) ?? null,
    }));
  });
}
