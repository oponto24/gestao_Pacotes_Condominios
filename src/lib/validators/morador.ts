import { z } from 'zod';
import { PHONE_REGEX, normalizePhone } from './_shared';

/**
 * Validação Zod para Morador (tenant-scoped).
 *
 * - `condominio_id` NÃO está no schema — vem do tenant context
 * - `nome_normalizado` calculado server-side (não vem do payload)
 * - PATCH NÃO tem `unidade_id` — mover morador requer recriar (defesa
 *   contra escape de unit; UX explícita)
 */

const optionalString = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `${label} muito longo (max ${max})`).optional(),
  );

const baseShape = {
  nome: z
    .string()
    .trim()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(200, 'Nome muito longo (max 200)'),

  telefone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Telefone inválido — use (XX) XXXXX-XXXX ou +55XXXXXXXXXXX')
    .transform(normalizePhone),

  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email('E-mail inválido').max(200, 'E-mail muito longo (max 200)').optional(),
  ),

  is_principal: z.boolean().optional().default(false),
};

/** CREATE inclui `unidade_id` obrigatório. */
export const moradorCreateSchema = z.object({
  ...baseShape,
  unidade_id: z.string().uuid('unidade_id inválido (UUID esperado)'),
});

/** PATCH NÃO inclui `unidade_id` — mover morador requer recriar. */
export const moradorUpdateSchema = z
  .object({ ...baseShape, ativo: z.boolean().optional() })
  .partial();

export type MoradorCreateInput = z.infer<typeof moradorCreateSchema>;
export type MoradorUpdateInput = z.infer<typeof moradorUpdateSchema>;

export const moradorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: optionalString(100, 'Busca'),
  unidade_id: z.string().uuid().optional(),
  include_inativos: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  include_arquivados: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
});

export type MoradorListQuery = z.infer<typeof moradorListQuerySchema>;
