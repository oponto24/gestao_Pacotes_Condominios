/**
 * DB helpers de confirmação de pacote (story 3.8).
 *
 * Carrega dados pra tela `/chegada/confirmar/[id]` e persiste a
 * confirmação via PATCH `/api/pacotes/{id}/confirmar`.
 */

import { withTenantContext } from '@/server/db-tenant';
import type { PacoteConfirmarInput } from '@/lib/validators/pacote-confirmar';
import { NotFoundError, ValidationError } from '@/server/errors';

/** Contexto tenant (porteiro/admin) — não aceita super_admin. */
export interface ConfirmarCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
}

export type ConfirmarErrorCode =
  | 'pacote_not_found'
  | 'unidade_invalid'
  | 'destinatario_invalid'
  | 'pacote_canceled'
  | 'pacote_retirado';

export interface PacoteForConfirmar {
  id: string;
  status: string;
  ia_confianca: number | null;
  nome_destinatario_etiqueta: string | null;
  endereco_etiqueta: string | null;
  cep_etiqueta: string | null;
  complemento_etiqueta: string | null;
  remetente: string | null;
  unidade_id: string | null;
  destinatario_id: string | null;
  destinatario_resolvido_via: string | null;
  cep_diverge: boolean;
  foto_storage_path: string;
  foto_mime_type: string;
  unidades: Array<{ id: string; identificador: string; bloco: string | null }>;
  moradores: Array<{
    id: string;
    unidade_id: string;
    nome: string;
    is_principal: boolean;
  }>;
  ja_confirmado: boolean;
  condominio_cep: string;
}

/**
 * Carrega pacote + foto + unidades + moradores ativos do tenant.
 * Retorna null se pacote não existe ou está em estado terminal (cancelado/retirado).
 */
export async function loadPacoteForConfirmar(
  ctx: ConfirmarCtx,
  pacoteId: string,
): Promise<PacoteForConfirmar | null> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: {
        id: true,
        status: true,
        ia_confianca: true,
        ia_extracao_raw: true,
        nome_destinatario_etiqueta: true,
        endereco_etiqueta: true,
        cep_etiqueta: true,
        complemento_etiqueta: true,
        remetente: true,
        unidade_id: true,
        destinatario_id: true,
        destinatario_resolvido_via: true,
      },
    });
    if (!pacote) return null;
    if (pacote.status === 'cancelado' || pacote.status === 'retirado') return null;

    const foto = await tx.pacoteFoto.findFirst({
      where: { pacote_id: pacoteId, is_principal: true },
      select: { storage_path: true, mime_type: true },
    });
    if (!foto) return null;

    const condominio = await tx.condominio.findFirstOrThrow({
      select: { cep: true },
      where: { id: ctx.condominioId },
    });

    const unidades = await tx.unidade.findMany({
      where: { ativo: true },
      select: { id: true, identificador: true, bloco: true },
      orderBy: [{ bloco: 'asc' }, { identificador: 'asc' }],
    });

    const moradores = await tx.morador.findMany({
      where: { ativo: true, deleted_at: null },
      select: {
        id: true,
        unidade_id: true,
        nome: true,
        is_principal: true,
      },
      orderBy: [{ is_principal: 'desc' }, { nome: 'asc' }],
    });

    const eventoConfirmado = await tx.pacoteEvento.findFirst({
      where: { pacote_id: pacoteId, tipo: 'confirmado' },
      select: { id: true },
    });

    // Extrai cep_diverge do evento ia_processou (3.7) se existir
    const eventoIa = await tx.pacoteEvento.findFirst({
      where: { pacote_id: pacoteId, tipo: 'ia_processou' },
      select: { metadata: true },
      orderBy: { created_at: 'desc' },
    });
    let cepDiverge = false;
    if (eventoIa?.metadata && typeof eventoIa.metadata === 'object') {
      const meta = eventoIa.metadata as Record<string, unknown>;
      const matching = meta.matching as Record<string, unknown> | undefined;
      cepDiverge = matching?.cep_diverge === true;
    }

    return {
      id: pacote.id,
      status: pacote.status,
      ia_confianca: pacote.ia_confianca ? Number(pacote.ia_confianca) : null,
      nome_destinatario_etiqueta: pacote.nome_destinatario_etiqueta,
      endereco_etiqueta: pacote.endereco_etiqueta,
      cep_etiqueta: pacote.cep_etiqueta,
      complemento_etiqueta: pacote.complemento_etiqueta,
      remetente: pacote.remetente,
      unidade_id: pacote.unidade_id,
      destinatario_id: pacote.destinatario_id,
      destinatario_resolvido_via: pacote.destinatario_resolvido_via,
      cep_diverge: cepDiverge,
      foto_storage_path: foto.storage_path,
      foto_mime_type: foto.mime_type,
      unidades,
      moradores,
      ja_confirmado: !!eventoConfirmado,
      condominio_cep: condominio.cep,
    };
  });
}

export interface ConfirmarPacoteResult {
  pacote_id: string;
  already_confirmed: boolean;
}

export async function confirmarPacote(
  ctx: ConfirmarCtx,
  pacoteId: string,
  input: PacoteConfirmarInput,
): Promise<ConfirmarPacoteResult> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: { id: true, status: true },
    });
    if (!pacote) throw new NotFoundError('Pacote não encontrado');
    if (pacote.status === 'cancelado' || pacote.status === 'retirado') {
      throw new ValidationError(`Pacote em estado terminal: ${pacote.status}`);
    }

    // Idempotência
    const existing = await tx.pacoteEvento.findFirst({
      where: { pacote_id: pacoteId, tipo: 'confirmado' },
      select: { id: true },
    });
    if (existing) {
      return { pacote_id: pacoteId, already_confirmed: true };
    }

    // Valida unidade pertence ao tenant
    const unidade = await tx.unidade.findFirst({
      where: { id: input.unidade_id, ativo: true },
      select: { id: true },
    });
    if (!unidade) throw new ValidationError('Unidade inválida ou inativa');

    // Valida destinatário, se informado, pertence à unidade
    if (input.destinatario_id) {
      const morador = await tx.morador.findFirst({
        where: {
          id: input.destinatario_id,
          unidade_id: input.unidade_id,
          ativo: true,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!morador) {
        throw new ValidationError('Destinatário inválido ou não pertence à unidade');
      }
    }

    const resolvidoVia: 'destinatario_cadastrado' | 'manual_override' =
      input.destinatario_id ? 'destinatario_cadastrado' : 'manual_override';

    // Sobrescreve nome_destinatario_etiqueta com o nome final
    await tx.pacote.update({
      where: { id: pacoteId },
      data: {
        nome_destinatario_etiqueta: input.nome_destinatario,
        endereco_etiqueta: input.endereco,
        cep_etiqueta: input.cep,
        complemento_etiqueta: input.complemento,
        remetente: input.remetente,
        unidade_id: input.unidade_id,
        destinatario_id: input.destinatario_id,
        destinatario_resolvido_via: resolvidoVia,
        // Se estava em pendente_identificacao, volta pra rascunho (3.9 organizar)
        status: pacote.status === 'pendente_identificacao' ? 'rascunho' : pacote.status,
      },
    });

    await tx.pacoteEvento.create({
      data: {
        condominio_id: ctx.condominioId,
        pacote_id: pacoteId,
        tipo: 'confirmado',
        user_id: ctx.userId,
        metadata: {
          resolvido_via: resolvidoVia,
          unidade_id: input.unidade_id,
          destinatario_id: input.destinatario_id,
        },
      },
    });

    return { pacote_id: pacoteId, already_confirmed: false };
  });
}
