import { z } from 'zod';

/**
 * Schema da resposta JSON do Claude Haiku para extração de etiqueta (story 3.5).
 *
 * Anthropic não tem function calling estruturado como OpenAI — pedimos JSON
 * em texto e validamos com Zod. Se IA mandar markdown, regex extrai o bloco
 * antes do parse.
 *
 * Todos os campos textuais são opcionais (IA pode não conseguir ler tudo).
 * `confianca` é obrigatório — IA estima 0-1 baseado em legibilidade.
 */

const TRANSPORTADORAS = [
  'correios',
  'magalu',
  'melhor_envio',
  'super_frete',
  'loggi',
  'mercado_livre',
  'shopee',
  'amazon',
  'tiktok_shop', // TikTok Shop / iMile — adicionado 2026-05-08
  'imile',
  'outro',
] as const;

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

export const labelExtractionSchema = z.object({
  nome_destinatario: optionalString(200),
  endereco: optionalString(500),
  /**
   * CEP brasileiro com ou sem hífen.
   *
   * **Tolerância (2026-05-08):** se IA retornar CEP malformado (5 ou 6 dígitos —
   * típico em foto cortada), normaliza pra `null` em vez de rejeitar o objeto
   * inteiro. Assim os outros campos válidos (nome/endereço/apto) ainda chegam
   * pro porteiro confirmar.
   */
  cep: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return null;
      const trimmed = v.trim();
      if (trimmed === '') return null;
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 8) return null; // tolerante: vira null
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    },
    z
      .string()
      .regex(/^\d{5}-\d{3}$/, 'CEP inválido (esperado XXXXX-XXX)')
      .nullable()
      .optional(),
  ),
  /** Apto/bloco/casa — texto livre. */
  complemento: optionalString(200),
  /** Código de rastreio extraído do código de barras / texto da etiqueta. */
  codigo_rastreio: optionalString(100),
  /**
   * Transportadora.
   *
   * **Tolerância (2026-05-08):** valor desconhecido (ex: IA retorna
   * 'tiktok_shop' que ainda não está no enum) vira `'outro'` em vez de
   * rejeitar. Mantém o resto dos campos válidos.
   */
  transportadora: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const lc = v.trim().toLowerCase();
      if (lc === '') return null;
      return (TRANSPORTADORAS as readonly string[]).includes(lc) ? lc : 'outro';
    },
    z.enum(TRANSPORTADORAS).nullable().optional(),
  ),
  remetente: optionalString(200),
  /** Confiança de 0 a 1 — IA estima baseado em legibilidade da etiqueta. */
  confianca: z.number().min(0).max(1),
});

export type LabelExtraction = z.infer<typeof labelExtractionSchema>;
