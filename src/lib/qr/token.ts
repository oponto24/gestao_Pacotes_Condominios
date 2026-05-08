import { randomBytes } from 'node:crypto';

/**
 * Gera um token único e URL-safe para identificar um pacote.
 *
 * 48 bytes randômicos → 64 chars base64url. Cabe no `pacote.qr_token VARCHAR(64)`.
 * Colisão é estatisticamente impossível, mas o caller deve usar índice unique no DB.
 */
export function generateQrToken(): string {
  return randomBytes(48).toString('base64url').slice(0, 64);
}
