import { z } from 'zod';

/**
 * Validador do payload textual do POST /api/pacotes (story 3.4).
 *
 * Apenas campos textuais. Foto vai por outra via (multipart `file` field).
 * Outros campos do Pacote NÃO entram aqui — IA preenche depois (story 3.5).
 */

const codigoRastreioRegex = /^[A-Za-z0-9.\-/ ]+$/;

export const pacoteCreateInputSchema = z.object({
  codigo_rastreio: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .trim()
      .max(100, 'Código de rastreio muito longo (max 100)')
      .regex(
        codigoRastreioRegex,
        'Código de rastreio aceita apenas letras, números, hífen, ponto, barra e espaço',
      )
      .optional(),
  ),
});

export type PacoteCreateInput = z.infer<typeof pacoteCreateInputSchema>;
