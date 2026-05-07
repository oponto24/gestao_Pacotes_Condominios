import { z } from 'zod';

/**
 * Validadores das APIs de retirada (Epic 5).
 */

const TOKEN_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export const retirarIniciarSchema = z.object({
  qr_token: z.string().regex(TOKEN_REGEX, 'qr_token inválido'),
});

export const retirarConfirmarSchema = z
  .object({
    proprio_destinatario: z.boolean(),
    retirado_por_terceiro: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().min(3).max(200).nullable(),
    ),
  })
  .refine(
    (data) => {
      if (data.proprio_destinatario === false) {
        return !!data.retirado_por_terceiro;
      }
      return true;
    },
    { message: 'Nome do terceiro obrigatório quando proprio_destinatario=false' },
  );

export type RetirarIniciarInput = z.infer<typeof retirarIniciarSchema>;
export type RetirarConfirmarInput = z.infer<typeof retirarConfirmarSchema>;
