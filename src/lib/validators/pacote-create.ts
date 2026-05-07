import { z } from 'zod';

/**
 * Validador do payload textual do POST /api/pacotes (story 3.4).
 *
 * Apenas campos textuais. Foto vai por outra via (multipart `file` field).
 * Outros campos do Pacote NÃO entram aqui — IA preenche depois (story 3.5).
 */

// Aceita ASCII imprimível exceto `<` e `>` (defesa XSS).
// SQL injection já é prevenido pelas parameterized queries do Prisma.
// QR Codes reais (JSON, URLs) precisam aceitar `{}":?=&` etc.
const codigoRastreioRegex = /^[\x20-\x7E]+$/;
const ANGLE_BRACKET = /[<>]/;

export const pacoteCreateInputSchema = z.object({
  codigo_rastreio: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .trim()
      .max(200, 'Código de rastreio muito longo (max 200)')
      .regex(codigoRastreioRegex, 'Código contém caracteres não-imprimíveis')
      .refine((v) => !ANGLE_BRACKET.test(v), {
        message: 'Código não pode conter < ou >',
      })
      .optional(),
  ),
});

export type PacoteCreateInput = z.infer<typeof pacoteCreateInputSchema>;
