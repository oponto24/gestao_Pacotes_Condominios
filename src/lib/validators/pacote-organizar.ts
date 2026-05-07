import { z } from 'zod';

/**
 * Validador do PATCH /api/pacotes/{id}/organizar (story 3.9).
 *
 * Define tamanho do pacote + setor de armazenamento + posição (opcional).
 * Após organização, status do pacote vira `aguardando_retirada` (FR-030),
 * gatilho para Epic 4 (notificação WhatsApp).
 */

export const pacoteOrganizarInputSchema = z.object({
  tamanho: z.enum(['pequeno', 'medio', 'grande', 'extra_grande']),
  setor_id: z.string().uuid('Setor obrigatório'),
  posicao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(50, 'Posição muito longa (max 50)').nullable(),
  ),
});

export type PacoteOrganizarInput = z.infer<typeof pacoteOrganizarInputSchema>;
