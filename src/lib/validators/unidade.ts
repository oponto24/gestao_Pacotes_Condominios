import { z } from 'zod';

/**
 * Validação Zod para Unidade (tenant-scoped).
 *
 * `condominio_id` NÃO está no schema — vem do tenant context (defesa contra
 * escape via input).
 *
 * Unique composite no DB: (condominio_id, identificador, bloco). `bloco` NULL
 * é tratado como valor distinto pelo Postgres em UNIQUE — caller deve fazer
 * check explícito antes do insert (ver `findUnidadeByIdentificador`).
 */

const optionalString = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `${label} muito longo (max ${max})`).optional(),
  );

const baseShape = {
  identificador: z
    .string()
    .trim()
    .min(1, 'Identificador é obrigatório')
    .max(50, 'Identificador muito longo (max 50)'),

  bloco: optionalString(50, 'Bloco'),
  bloco_id: z.string().uuid('Bloco inválido').optional().nullable(),
  observacoes: optionalString(500, 'Observações'),
};

export const unidadeCreateSchema = z.object(baseShape);

export const unidadeUpdateSchema = z
  .object({ ...baseShape, ativo: z.boolean().optional() })
  .partial();

export type UnidadeCreateInput = z.infer<typeof unidadeCreateSchema>;
export type UnidadeUpdateInput = z.infer<typeof unidadeUpdateSchema>;

export const unidadeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().min(1).optional(),
  include_inativas: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
});

export type UnidadeListQuery = z.infer<typeof unidadeListQuerySchema>;
