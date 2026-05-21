/**
 * Parser de palavra-chave (Epic 7).
 *
 * Aceita códigos numéricos (ML 123456) e alfanuméricos (FACA, mesa123).
 * Mensagens curtas (<80 chars) sem pontuação complexa são tratadas como
 * palavra-chave direta.
 */

export interface PalavraChaveExtraida {
  codigo: string;
  descricao: string | null;
}

const PREFIXED_PATTERNS: RegExp[] = [
  // "código FACA" ou "codigo 123456" ou "palavra chave ABC123"
  /\b(?:c[oó]digo|palavra[\s-]?chave|chave)[\s:]+([A-Za-z0-9À-ÿ]{2,20})\b/i,
  // "ML 123456" — varejistas com prefixo
  /\bML\s*[:\-]?\s*(\d{4,10})\b/i,
];

// Mensagem curta e simples = provavelmente é a palavra-chave inteira
const SHORT_MESSAGE_REGEX = /^[A-Za-z0-9À-ÿ\s]{2,40}$/;

/**
 * Tenta extrair palavra-chave da mensagem do morador.
 * Retorna null se não parecer uma palavra-chave.
 */
export function parsePalavraChave(messageText: string): PalavraChaveExtraida | null {
  const text = messageText.trim();
  if (!text) return null;

  // 1. Tenta padrões com prefixo
  for (const pattern of PREFIXED_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const codigo = match[1].toUpperCase();
      const descricao = text
        .replace(match[0], '')
        .replace(/\b(?:codigo|c[oó]digo|chave|palavra[\s-]?chave|ml)\b/gi, '')
        .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        codigo,
        descricao: descricao.length >= 3 ? descricao.slice(0, 200) : null,
      };
    }
  }

  // 2. Mensagem curta e simples = palavra-chave direta
  if (text.length <= 40 && SHORT_MESSAGE_REGEX.test(text)) {
    const codigo = text.toUpperCase().trim();
    // Ignora saudações comuns
    const saudacoes = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|sim|n[aã]o|tudo bem|blz)$/i;
    if (saudacoes.test(codigo)) return null;
    return { codigo, descricao: null };
  }

  return null;
}
