import { z } from 'zod';

/**
 * Validador do PATCH /api/pacotes/{id}/confirmar (story 3.8).
 *
 * Admin/porteiro confirma os dados extraídos pela IA antes do pacote
 * seguir para organização (3.9). Sempre exige unidade_id; destinatario_id
 * pode ser null se o destinatário não for um morador cadastrado.
 */

const cepRegex = /^\d{5}-?\d{3}$/;

const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable(),
  );

export const pacoteConfirmarInputSchema = z.object({
  nome_destinatario: z
    .string()
    .trim()
    .min(1, 'Nome do destinatário é obrigatório')
    .max(200, 'Nome muito longo (max 200)'),
  endereco: optStr(500),
  cep: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z
      .string()
      .trim()
      .regex(cepRegex, 'CEP inválido (use 00000-000)')
      .nullable(),
  ),
  complemento: optStr(200),
  remetente: optStr(200),
  unidade_id: z.string().uuid('Unidade obrigatória'),
  destinatario_id: z.string().uuid().nullable(),
});

export type PacoteConfirmarInput = z.infer<typeof pacoteConfirmarInputSchema>;
