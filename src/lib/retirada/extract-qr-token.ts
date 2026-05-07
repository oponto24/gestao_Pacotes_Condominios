/**
 * Extrai e valida `qr_token` de uma string (story 5.1).
 *
 * Aceita 3 formatos:
 *   1. Token puro: "abc123def456..." (16-64 chars alfanuméricos + - _)
 *   2. URL relativa: "/retirada/confirmar/abc123def456"
 *   3. URL absoluta: "https://condominios.oponto24.com.br/retirada/confirmar/abc123def456"
 *
 * Retorna `null` se inválido. Função pura, testável.
 */

const TOKEN_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export function extractQrToken(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Caso 1 — token puro
  if (TOKEN_REGEX.test(trimmed)) return trimmed;

  // Caso 2/3 — URL: extrai segmento após "/retirada/confirmar/"
  const match = trimmed.match(/\/retirada\/confirmar\/([A-Za-z0-9_-]+)/);
  if (match && match[1] && TOKEN_REGEX.test(match[1])) {
    return match[1];
  }

  return null;
}

export function isValidQrToken(token: string): boolean {
  return TOKEN_REGEX.test(token);
}
