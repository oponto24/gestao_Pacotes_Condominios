/**
 * Parser de palavra-chave (Epic 7).
 *
 * Estratégia: regex primeiro (rápido + barato), LLM só se regex falhar (custo).
 * Mercado Livre tipicamente envia 6 dígitos numéricos. Outros varejistas variam.
 */

export interface PalavraChaveExtraida {
  codigo: string;
  descricao: string | null;
}

const REGEX_PATTERNS: RegExp[] = [
  // "código 123456" ou "codigo 123456" — 4 a 10 dígitos
  /\b(?:c[oó]digo|palavra-?chave|chave)[\s:]+(\d{4,10})\b/i,
  // "ML 123456" — varejistas que usam prefixo
  /\bML\s*[:\-]?\s*(\d{4,10})\b/i,
  // 4-10 dígitos isolados em mensagem curta (<60 chars)
  /^[^\d]*(\d{4,10})[^\d]*$/,
];

/**
 * Tenta extrair palavra-chave da mensagem do morador via regex.
 * Retorna null se nenhum padrão casar.
 */
export function parsePalavraChave(messageText: string): PalavraChaveExtraida | null {
  const text = messageText.trim();
  if (!text) return null;

  for (const pattern of REGEX_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const codigo = match[1];
      // Descrição = texto sem o código nem palavras-chave de contexto
      const descricao = text
        .replace(match[0], '')
        .replace(/\b(?:codigo|c[oó]digo|chave|palavra-?chave|ml)\b/gi, '')
        .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        codigo,
        descricao: descricao.length >= 3 ? descricao.slice(0, 200) : null,
      };
    }
  }

  return null;
}
