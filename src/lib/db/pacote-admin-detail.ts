/**
 * Detalhe completo de um pacote (story 6.3).
 */

import { withTenantContext } from '@/server/db-tenant';

export interface AdminCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin' | 'porteiro';
}

export interface PacoteDetailEvento {
  id: string;
  tipo: string;
  created_at: Date;
  user_id: string | null;
  user_nome: string | null;
  metadata: unknown;
}

export interface PacoteDetail {
  id: string;
  status: string;
  codigo_rastreio: string | null;
  transportadora: string | null;
  nome_destinatario_etiqueta: string | null;
  endereco_etiqueta: string | null;
  cep_etiqueta: string | null;
  complemento_etiqueta: string | null;
  remetente: string | null;
  ia_confianca: number | null;
  ia_extracao_raw: unknown;
  destinatario_resolvido_via: string | null;
  tamanho: string | null;
  posicao: string | null;
  recebido_em: Date | null;
  retirado_em: Date | null;
  qr_consumido_em: Date | null;
  retirado_por_terceiro: string | null;
  unidade: { id: string; identificador: string; bloco: string | null } | null;
  destinatario: { id: string; nome: string; telefone: string } | null;
  setor: { id: string; nome: string } | null;
  funcionario_recebedor: { id: string; nome: string } | null;
  funcionario_entregador: { id: string; nome: string } | null;
  retirado_por_morador: { id: string; nome: string } | null;
  foto_storage_path: string | null;
  eventos: PacoteDetailEvento[];
}

export async function loadPacoteDetail(
  ctx: AdminCtx,
  pacoteId: string,
): Promise<PacoteDetail | null> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: {
        id: true,
        status: true,
        codigo_rastreio: true,
        transportadora: true,
        nome_destinatario_etiqueta: true,
        endereco_etiqueta: true,
        cep_etiqueta: true,
        complemento_etiqueta: true,
        remetente: true,
        ia_confianca: true,
        ia_extracao_raw: true,
        destinatario_resolvido_via: true,
        tamanho: true,
        posicao: true,
        recebido_em: true,
        retirado_em: true,
        qr_consumido_em: true,
        retirado_por_terceiro: true,
        unidade: { select: { id: true, identificador: true, bloco: true } },
        destinatario: { select: { id: true, nome: true, telefone: true } },
        setor: { select: { id: true, nome: true } },
        funcionario_recebedor: { select: { id: true, nome: true } },
        funcionario_entregador: { select: { id: true, nome: true } },
        retirado_por_morador: { select: { id: true, nome: true } },
      },
    });
    if (!pacote) return null;

    const foto = await tx.pacoteFoto.findFirst({
      where: { pacote_id: pacoteId, is_principal: true },
      select: { storage_path: true },
    });

    const eventosRaw = await tx.pacoteEvento.findMany({
      where: { pacote_id: pacoteId },
      select: {
        id: true,
        tipo: true,
        created_at: true,
        user_id: true,
        metadata: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Resolve nomes dos users (nem todos eventos têm user_id)
    const userIds = [...new Set(eventosRaw.map((e) => e.user_id).filter(Boolean) as string[])];
    const users = userIds.length
      ? await tx.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nome: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.nome]));

    const eventos: PacoteDetailEvento[] = eventosRaw.map((e) => ({
      id: e.id.toString(),
      tipo: e.tipo,
      created_at: e.created_at,
      user_id: e.user_id,
      user_nome: e.user_id ? userMap.get(e.user_id) ?? null : null,
      metadata: e.metadata,
    }));

    return {
      ...pacote,
      ia_confianca: pacote.ia_confianca ? Number(pacote.ia_confianca) : null,
      foto_storage_path: foto?.storage_path ?? null,
      eventos,
    };
  });
}
