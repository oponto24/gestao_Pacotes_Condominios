import { z } from 'zod';
import { PHONE_REGEX, normalizePhone } from './_shared';

/**
 * Validação Zod para uma linha do CSV de importação (story 2.5).
 *
 * Schema do CSV:
 *   bloco,identificador,morador_nome,morador_telefone,morador_email
 *
 * - `bloco` opcional (string vazia = sem bloco)
 * - `morador_email` opcional
 * - Demais campos obrigatórios
 * - `nome_normalizado` calculado server-side na story 2.6 (commit) — não vem do CSV
 * - Cada linha importada vira um morador com `is_principal=true` (decisão @po)
 */

const optionalTrimmed = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `${label} muito longo (max ${max})`).optional(),
  );

export const csvRowSchema = z.object({
  bloco: optionalTrimmed(50, 'Bloco'),

  identificador: z
    .string()
    .trim()
    .min(1, 'Identificador obrigatório')
    .max(50, 'Identificador muito longo (max 50)'),

  morador_nome: z
    .string()
    .trim()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(200, 'Nome muito longo (max 200)'),

  morador_telefone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Telefone inválido — use (XX) XXXXX-XXXX ou +55XXXXXXXXXXX')
    .transform(normalizePhone),

  morador_email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email('E-mail inválido').max(200, 'E-mail muito longo (max 200)').optional(),
  ),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

/** Colunas obrigatórias do cabeçalho. `bloco` é coluna obrigatória mas valor opcional. */
export const REQUIRED_HEADERS = [
  'bloco',
  'identificador',
  'morador_nome',
  'morador_telefone',
  'morador_email',
] as const;

export type CsvHeader = (typeof REQUIRED_HEADERS)[number];
