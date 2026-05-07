import { z } from 'zod';

/**
 * Validação Zod compartilhada client+server para Condominio.
 *
 * Estratégia:
 * - Inputs aceitam pontuação humana (CNPJ/CEP/telefone formatados)
 * - `transform` normaliza pra forma canônica (sem pontuação) ANTES do save
 * - Mensagens em português
 */

// XX.XXX.XXX/XXXX-XX (com pontuação) ou 14 dígitos puros
const CNPJ_REGEX = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/;
// XXXXX-XXX (com hífen) ou 8 dígitos
const CEP_REGEX = /^(\d{5}-\d{3}|\d{8})$/;
// E.164 (+55XXXXXXXXXXX, 12-14 dígitos no total) OU formato BR (XX) XXXXX-XXXX / XX XXXXX-XXXX / com ou sem espaços
const PHONE_REGEX = /^(\+\d{12,14}|\(?\d{2}\)?\s?\d{4,5}-?\d{4})$/;
// UF brasileiro — exatamente 2 chars uppercase
const UF_REGEX = /^[A-Z]{2}$/;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Normaliza telefone BR pra E.164 (+55XXXXXXXXXXX). */
function normalizePhone(phone: string): string {
  const d = digitsOnly(phone);
  // Já tem código do país
  if (d.length >= 12 && d.startsWith('55')) return `+${d}`;
  // Formato nacional (10 ou 11 dígitos)
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}

const baseShape = {
  nome: z
    .string()
    .trim()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(200, 'Nome muito longo (max 200)'),

  cnpj: z
    .string()
    .trim()
    .regex(CNPJ_REGEX, 'CNPJ inválido — use 00.000.000/0000-00 ou 14 dígitos')
    .transform(digitsOnly)
    .optional()
    .or(z.literal('').transform(() => undefined)),

  endereco: z
    .string()
    .trim()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .max(300, 'Endereço muito longo (max 300)'),

  cep: z
    .string()
    .trim()
    .regex(CEP_REGEX, 'CEP inválido — use 00000-000 ou 8 dígitos')
    .transform(digitsOnly),

  cidade: z
    .string()
    .trim()
    .min(2, 'Cidade deve ter pelo menos 2 caracteres')
    .max(100, 'Cidade muito longa (max 100)'),

  estado: z
    .string()
    .trim()
    .regex(UF_REGEX, 'Estado deve ser UF de 2 letras maiúsculas (ex: SP)'),

  contato_nome: z
    .string()
    .trim()
    .min(3, 'Nome do contato deve ter pelo menos 3 caracteres')
    .max(200, 'Nome muito longo (max 200)'),

  contato_telefone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Telefone inválido — use (XX) XXXXX-XXXX ou +55XXXXXXXXXXX')
    .transform(normalizePhone),

  contato_email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .max(200, 'E-mail muito longo (max 200)')
    .optional()
    .or(z.literal('').transform(() => undefined)),
};

export const condominioCreateSchema = z.object(baseShape);

export const condominioUpdateSchema = z.object(baseShape).partial();

export type CondominioCreateInput = z.infer<typeof condominioCreateSchema>;
export type CondominioUpdateInput = z.infer<typeof condominioUpdateSchema>;

export const condominioListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  include_arquivados: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
});

export type CondominioListQuery = z.infer<typeof condominioListQuerySchema>;
