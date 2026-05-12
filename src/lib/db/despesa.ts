/**
 * Despesas globais do app — acesso super-admin only.
 * Tabela `despesa` não tem condominio_id (registros globais de infra/IA/telecom).
 */
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface DespesaRow {
  id: string;
  servico: string;
  descricao: string | null;
  id_pagamento: string | null;
  id_assinatura: string | null;
  valor_brl: number | null;
  pago_em: Date;
  criado_em: Date;
}

export async function listDespesas(): Promise<DespesaRow[]> {
  const rows = await db.despesa.findMany({
    orderBy: { pago_em: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    servico: r.servico,
    descricao: r.descricao,
    id_pagamento: r.id_pagamento,
    id_assinatura: r.id_assinatura,
    valor_brl: r.valor_brl ? Number(r.valor_brl) : null,
    pago_em: r.pago_em,
    criado_em: r.criado_em,
  }));
}

export interface CriarDespesaInput {
  servico: string;
  descricao: string | null;
  id_pagamento: string | null;
  id_assinatura: string | null;
  valor_brl: number | null; // BRL com 2 decimais
  pago_em: Date;
}

export async function criarDespesa(input: CriarDespesaInput): Promise<DespesaRow> {
  const row = await db.despesa.create({
    data: {
      servico: input.servico,
      descricao: input.descricao,
      id_pagamento: input.id_pagamento,
      id_assinatura: input.id_assinatura,
      valor_brl: input.valor_brl ? new Prisma.Decimal(input.valor_brl) : null,
      pago_em: input.pago_em,
    },
  });
  return {
    id: row.id,
    servico: row.servico,
    descricao: row.descricao,
    id_pagamento: row.id_pagamento,
    id_assinatura: row.id_assinatura,
    valor_brl: row.valor_brl ? Number(row.valor_brl) : null,
    pago_em: row.pago_em,
    criado_em: row.criado_em,
  };
}

export async function atualizarDespesa(
  id: string,
  input: CriarDespesaInput,
): Promise<DespesaRow> {
  const row = await db.despesa.update({
    where: { id },
    data: {
      servico: input.servico,
      descricao: input.descricao,
      id_pagamento: input.id_pagamento,
      id_assinatura: input.id_assinatura,
      valor_brl: input.valor_brl ? new Prisma.Decimal(input.valor_brl) : null,
      pago_em: input.pago_em,
    },
  });
  return {
    id: row.id,
    servico: row.servico,
    descricao: row.descricao,
    id_pagamento: row.id_pagamento,
    id_assinatura: row.id_assinatura,
    valor_brl: row.valor_brl ? Number(row.valor_brl) : null,
    pago_em: row.pago_em,
    criado_em: row.criado_em,
  };
}

export async function removerDespesa(id: string): Promise<void> {
  await db.despesa.delete({ where: { id } });
}
