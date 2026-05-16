import { z } from 'zod';

/**
 * Validacao Zod compartilhada client+server para Bloco (tenant-scoped).
 *
 * `condominio_id` NAO esta no schema — vem do tenant context, nunca do payload
 * (defesa em profundidade contra escape de tenant via input).
 */

const baseShape = {
  nome: z
    .string()
    .trim()
    .min(1, 'Nome e obrigatorio')
    .max(50, 'Nome muito longo (max 50)'),

  descricao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(500, 'Descricao muito longa (max 500)').optional(),
  ),

  ordem: z
    .union([
      z.coerce.number().int().min(0, 'Ordem deve ser >= 0').max(9999, 'Ordem muito alta (max 9999)'),
      z.literal('').transform(() => undefined),
      z.null().transform(() => undefined),
    ])
    .optional(),
};

export const blocoCreateSchema = z.object(baseShape);

export const blocoUpdateSchema = z
  .object({ ...baseShape, ativo: z.boolean().optional() })
  .partial();

export type BlocoCreateInput = z.infer<typeof blocoCreateSchema>;
export type BlocoUpdateInput = z.infer<typeof blocoUpdateSchema>;

export const blocoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  include_inativos: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
});

export type BlocoListQuery = z.infer<typeof blocoListQuerySchema>;
