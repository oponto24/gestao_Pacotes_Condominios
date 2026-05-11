import { z } from 'zod';

export const criarDespesaInputSchema = z.object({
  servico: z
    .string()
    .trim()
    .min(1, 'Serviço é obrigatório')
    .max(200, 'Máximo 200 caracteres'),
  descricao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(2000).nullable(),
  ),
  id_pagamento: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(100).nullable(),
  ),
  id_assinatura: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(100).nullable(),
  ),
  valor_brl: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      if (typeof v === 'string') {
        // Aceita "70.99" ou "70,99"
        const parsed = Number(v.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : v;
      }
      return v;
    },
    z.number().min(0, 'Valor deve ser >= 0').nullable(),
  ),
  pago_em: z.preprocess(
    (v) => (typeof v === 'string' ? new Date(v) : v),
    z.date(),
  ),
});

export type CriarDespesaInput = z.infer<typeof criarDespesaInputSchema>;
