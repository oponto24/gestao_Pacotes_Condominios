import Papa from 'papaparse';
import { csvRowSchema, REQUIRED_HEADERS, type CsvRowInput } from '@/lib/validators/csv-import';

/**
 * Parser RFC 4180 para CSV de importação de unidades + morador principal (story 2.5).
 *
 * Características:
 * - Síncrono, puro (sem I/O)
 * - Tolera BOM (Excel UTF-8)
 * - Tolera ordem das colunas (mapeia por nome)
 * - Limites duros: 1000 linhas, validador rejeita arquivos maiores
 * - Linhas em branco ignoradas (não contam como erro nem como válida)
 * - Validação cross-row: duplicatas de (bloco, identificador) e morador_telefone
 *
 * NÃO persiste nada — só devolve relatório estruturado para a UI da 2.5/2.6 consumir.
 */

export const MAX_ROWS = 1000;

export interface ValidRow extends CsvRowInput {
  /** Número da linha no arquivo original (1-indexed, considerando o cabeçalho como linha 1). */
  linha: number;
}

export interface InvalidRow {
  linha: number;
  raw: Record<string, string>;
  errors: string[];
}

export type ParseResult =
  | {
      kind: 'fatal';
      code: 'MISSING_HEADER' | 'MISSING_COLUMN' | 'TOO_MANY_ROWS';
      details: string;
    }
  | {
      kind: 'parsed';
      valid: ValidRow[];
      invalid: InvalidRow[];
      totalRows: number;
    };

/** Remove BOM (U+FEFF) do início se presente — Excel exporta UTF-8 com BOM por padrão. */
function stripBOM(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

export function parseImportCsv(input: string): ParseResult {
  const cleaned = stripBOM(input);

  // Parse com header — papaparse detecta cabeçalho automaticamente
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];

  // Detecta cabeçalho ausente (arquivo sem header ou só com 1 linha)
  if (headers.length === 0) {
    return {
      kind: 'fatal',
      code: 'MISSING_HEADER',
      details: 'Cabeçalho não encontrado. Linha 1 deve conter os nomes das colunas.',
    };
  }

  // Detecta colunas faltando
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      kind: 'fatal',
      code: 'MISSING_COLUMN',
      details: `Colunas obrigatórias ausentes: ${missing.join(', ')}. Esperado: ${REQUIRED_HEADERS.join(', ')}`,
    };
  }

  const rows = parsed.data;

  // Limite duro de linhas (anti-DoS)
  if (rows.length > MAX_ROWS) {
    return {
      kind: 'fatal',
      code: 'TOO_MANY_ROWS',
      details: `Arquivo tem ${rows.length} linhas, limite é ${MAX_ROWS}. Quebre em arquivos menores.`,
    };
  }

  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];

  // Passo 1: validação por linha
  rows.forEach((raw, idx) => {
    const linha = idx + 2; // +1 (1-indexed) +1 (skip cabeçalho)
    const result = csvRowSchema.safeParse(raw);

    if (result.success) {
      valid.push({ ...result.data, linha });
    } else {
      const errors = result.error.issues.map((iss) => {
        const path = iss.path.join('.');
        return path ? `${path}: ${iss.message}` : iss.message;
      });
      invalid.push({ linha, raw, errors });
    }
  });

  // Passo 2: validação cross-row — duplicatas de (bloco, identificador)
  const unidadeMap = new Map<string, number[]>();
  valid.forEach((row) => {
    const key = `${(row.bloco ?? '').toLowerCase()}|${row.identificador.toLowerCase()}`;
    const list = unidadeMap.get(key);
    if (list) list.push(row.linha);
    else unidadeMap.set(key, [row.linha]);
  });

  // Passo 3: validação cross-row — duplicatas de telefone
  const telefoneMap = new Map<string, number[]>();
  valid.forEach((row) => {
    const list = telefoneMap.get(row.morador_telefone);
    if (list) list.push(row.linha);
    else telefoneMap.set(row.morador_telefone, [row.linha]);
  });

  // Move duplicatas para invalid (mantém ordem original do arquivo)
  const dupUnidadeLinhas = new Set<number>();
  for (const [, linhas] of unidadeMap) {
    if (linhas.length > 1) linhas.forEach((l) => dupUnidadeLinhas.add(l));
  }

  const dupTelefoneLinhas = new Set<number>();
  for (const [, linhas] of telefoneMap) {
    if (linhas.length > 1) linhas.forEach((l) => dupTelefoneLinhas.add(l));
  }

  if (dupUnidadeLinhas.size > 0 || dupTelefoneLinhas.size > 0) {
    const stillValid: ValidRow[] = [];
    valid.forEach((row) => {
      const errs: string[] = [];

      if (dupUnidadeLinhas.has(row.linha)) {
        const conflitos = unidadeMap
          .get(`${(row.bloco ?? '').toLowerCase()}|${row.identificador.toLowerCase()}`)!
          .filter((l) => l !== row.linha);
        errs.push(
          `DUPLICATE_UNIDADE: (bloco='${row.bloco ?? ''}', identificador='${row.identificador}') também aparece em linha(s) ${conflitos.join(', ')}`,
        );
      }

      if (dupTelefoneLinhas.has(row.linha)) {
        const conflitos = telefoneMap
          .get(row.morador_telefone)!
          .filter((l) => l !== row.linha);
        errs.push(
          `DUPLICATE_TELEFONE: ${row.morador_telefone} também aparece em linha(s) ${conflitos.join(', ')}`,
        );
      }

      if (errs.length > 0) {
        invalid.push({
          linha: row.linha,
          raw: {
            bloco: row.bloco ?? '',
            identificador: row.identificador,
            morador_nome: row.morador_nome,
            morador_telefone: row.morador_telefone,
            morador_email: row.morador_email ?? '',
          },
          errors: errs,
        });
      } else {
        stillValid.push(row);
      }
    });

    valid.length = 0;
    valid.push(...stillValid);
  }

  // Reordena invalid por linha para preservar ordem do arquivo
  invalid.sort((a, b) => a.linha - b.linha);

  return {
    kind: 'parsed',
    valid,
    invalid,
    totalRows: rows.length,
  };
}
