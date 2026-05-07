/**
 * Matching IA-extraído ↔ Unidade/Morador (story 3.7).
 *
 * Algoritmo determinístico (sem IA) que pega `ia_extracao_raw` e tenta
 * vincular pacote a uma unidade + morador do condomínio.
 *
 * Resultados:
 *   - matched/destinatario_cadastrado — achou unidade E destinatário
 *   - matched/fallback_principal — achou unidade, sem destinatário, mas tem principal
 *   - pending/* — várias razões (ver `MatchPendingReason`)
 */

import { parseComplemento, type ParsedComplemento } from './parse-complemento';
import { nameSimilarity } from './normalize-name';

export interface MatchInput {
  condominio_cep: string;
  ia: {
    nome_destinatario: string | null;
    cep: string | null;
    complemento: string | null;
  };
  /** Lista de unidades do condomínio (ja filtrada por tenant). */
  unidades: ReadonlyArray<{ id: string; identificador: string; bloco: string | null }>;
  /** Lista de moradores ativos do condomínio (ja filtrada por tenant). */
  moradores: ReadonlyArray<{
    id: string;
    unidade_id: string;
    nome: string;
    nome_normalizado: string;
    is_principal: boolean;
  }>;
}

export type MatchPendingReason =
  | 'no_complemento'
  | 'unidade_nao_encontrada'
  | 'ambiguous_unidade'
  | 'no_morador';

export interface MatchFlags {
  cep_diverge: boolean;
  complemento_extraido: ParsedComplemento | null;
}

export type MatchResult =
  | {
      kind: 'matched';
      unidade_id: string;
      destinatario_id: string;
      resolvido_via: 'destinatario_cadastrado' | 'fallback_principal';
      flags: MatchFlags;
    }
  | {
      kind: 'pending';
      unidade_id: string | null;
      reason: MatchPendingReason;
      flags: MatchFlags;
    };

const NAME_SIMILARITY_THRESHOLD = 0.7;

/** Normaliza identificador da unidade pra extrair número (descarta "Apto", "Casa"). */
function extractIdentifierNumber(identificador: string): string {
  const m = identificador.match(/(\d+[A-Za-z]?(?:[-/]\d+)?)/);
  return (m?.[1] ?? identificador).toUpperCase();
}

function normalizeCep(cep: string | null | undefined): string {
  return (cep ?? '').replace(/\D/g, '');
}

export function matchUnidadeMorador(input: MatchInput): MatchResult {
  const complemento = parseComplemento(input.ia.complemento);

  const cepDiverge =
    !!input.ia.cep &&
    normalizeCep(input.ia.cep) !== normalizeCep(input.condominio_cep);

  const flags: MatchFlags = {
    cep_diverge: cepDiverge,
    complemento_extraido: complemento,
  };

  if (!complemento || !complemento.apto) {
    return { kind: 'pending', unidade_id: null, reason: 'no_complemento', flags };
  }

  // Match unidade pelo número do apto + bloco (se extraído)
  const aptoNum = complemento.apto.toUpperCase();
  const blocoExtraido = complemento.bloco?.toUpperCase() ?? null;

  const candidatas = input.unidades.filter((u) => {
    const idNum = extractIdentifierNumber(u.identificador);
    if (idNum !== aptoNum) return false;
    if (blocoExtraido && u.bloco) {
      return u.bloco.toUpperCase() === blocoExtraido;
    }
    return true;
  });

  if (candidatas.length === 0) {
    return {
      kind: 'pending',
      unidade_id: null,
      reason: 'unidade_nao_encontrada',
      flags,
    };
  }

  if (candidatas.length > 1) {
    return {
      kind: 'pending',
      unidade_id: null,
      reason: 'ambiguous_unidade',
      flags,
    };
  }

  const unidade = candidatas[0]!;

  // Match morador na unidade
  const moradoresUnidade = input.moradores.filter(
    (m) => m.unidade_id === unidade.id,
  );

  // 1. Tenta achar destinatário pelo nome
  if (input.ia.nome_destinatario) {
    let bestScore = 0;
    let bestMorador: (typeof moradoresUnidade)[number] | null = null;
    for (const m of moradoresUnidade) {
      const score = nameSimilarity(input.ia.nome_destinatario, m.nome);
      if (score > bestScore) {
        bestScore = score;
        bestMorador = m;
      }
    }
    if (bestMorador && bestScore >= NAME_SIMILARITY_THRESHOLD) {
      return {
        kind: 'matched',
        unidade_id: unidade.id,
        destinatario_id: bestMorador.id,
        resolvido_via: 'destinatario_cadastrado',
        flags,
      };
    }
  }

  // 2. Fallback: morador principal
  const principal = moradoresUnidade.find((m) => m.is_principal);
  if (principal) {
    return {
      kind: 'matched',
      unidade_id: unidade.id,
      destinatario_id: principal.id,
      resolvido_via: 'fallback_principal',
      flags,
    };
  }

  // 3. Sem morador
  return {
    kind: 'pending',
    unidade_id: unidade.id,
    reason: 'no_morador',
    flags,
  };
}
