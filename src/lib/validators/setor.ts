import { z } from 'zod';

/**
 * Validação Zod compartilhada client+server para Setor (tenant-scoped).
 *
 * `condominio_id` NÃO está no schema — vem do tenant context, nunca do payload
 * (defesa em profundidade contra escape de tenant via input).
 */

const baseShape = {
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo (max 100)'),

  descricao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(300, 'Descrição muito longa (max 300)').optional(),
  ),

  capacidade: z
    .union([
      z.coerce.number().int().min(1, 'Capacidade deve ser ≥ 1').max(9999, 'Capacidade muito alta (max 9999)'),
      z.literal('').transform(() => undefined),
      z.null().transform(() => undefined),
    ])
    .optional(),
};

export const setorCreateSchema = z.object(baseShape);

export const setorUpdateSchema = z
  .object({ ...baseShape, ativo: z.boolean().optional() })
  .partial();

export type SetorCreateInput = z.infer<typeof setorCreateSchema>;
export type SetorUpdateInput = z.infer<typeof setorUpdateSchema>;

export const setorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  include_inativos: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
});

export type SetorListQuery = z.infer<typeof setorListQuerySchema>;
