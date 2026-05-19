/**
 * Helpers compartilhados entre validators (telefone E.164, normalização).
 *
 * Telefone esperado em formato canônico **E.164 BR**: `+55` + DDD (2 dígitos)
 * + número (8 ou 9 dígitos). Aceita também formato BR humano `(XX) XXXXX-XXXX`
 * e normaliza no parse.
 */

/** Aceita E.164 (+12 a 14 dígitos) ou formato BR humano. */
export const PHONE_REGEX =
  /^(\+\d{12,14}|\(?\d{2}\)?\s?\d{4,5}-?\d{4})$/;

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Normaliza telefone BR para E.164 (`+55XXXXXXXXXXX`). */
export function normalizePhone(phone: string): string {
  const d = digitsOnly(phone);
  if (d.length >= 12 && d.startsWith('55')) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates and returns a UUID from route params. Returns null if invalid. */
export function parseIdParam(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  return UUID_RE.test(id) ? id : null;
}
