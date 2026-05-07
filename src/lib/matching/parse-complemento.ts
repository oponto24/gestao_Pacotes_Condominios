/**
 * Parse de complemento de endereço (story 3.7).
 *
 * Detecta apto/bloco/torre em strings BR comuns. 100% determinístico (regex).
 * Tolerante a abreviações: "AP", "Apto", "Apartamento", "Bl", "Bloco", "Tr", "Torre".
 */

export interface ParsedComplemento {
  apto: string | null;
  bloco: string | null;
}

const APTO_TOKENS = ['apartamento', 'apto', 'apt', 'ap', 'casa', 'cs'];
const BLOCO_TOKENS = ['bloco', 'bl', 'torre', 'tr', 'quadra', 'qd'];

const APTO_RE = new RegExp(
  `\\b(?:${APTO_TOKENS.join('|')})\\.?\\s*[-:]?\\s*([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)?)`,
  'i',
);
const BLOCO_RE = new RegExp(
  `\\b(?:${BLOCO_TOKENS.join('|')})\\.?\\s*[-:]?\\s*([A-Za-z0-9]+)`,
  'i',
);

export function parseComplemento(text: string | null | undefined): ParsedComplemento | null {
  if (!text || typeof text !== 'string') return null;
  const norm = text.trim().toLowerCase();
  if (norm.length === 0) return null;

  const aptoMatch = norm.match(APTO_RE);
  const blocoMatch = norm.match(BLOCO_RE);

  let apto: string | null = aptoMatch?.[1] ?? null;
  let bloco: string | null = blocoMatch?.[1] ?? null;

  // Suporta padrões com hífen tipo "AP 301-B" → apto=301, bloco=B
  if (apto && !bloco && /^\d+-[a-z]+$/i.test(apto)) {
    const [num, letra] = apto.split('-');
    apto = num ?? null;
    bloco = letra ?? null;
  }

  // Fallback: se não achou via tokens mas há um número solto curto, usa
  if (!apto && !bloco) {
    const fallback = norm.match(/^\s*(\d{1,5})\s*$/);
    if (fallback) apto = fallback[1] ?? null;
  }

  if (!apto && !bloco) return null;

  return {
    apto: apto?.toUpperCase() ?? null,
    bloco: bloco?.toUpperCase() ?? null,
  };
}
