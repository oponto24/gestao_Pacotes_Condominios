import { withSuperAdmin } from '@/lib/db-super-admin';
import { nameSimilarity, normalizeName } from '@/lib/matching/normalize-name';

/**
 * Lógica de escolha de destinatário da notificação WhatsApp (story 4.5).
 *
 * Prioridade (FR-031, FR-032):
 *   1. Morador da unidade cuja normalização do nome bate com o da etiqueta
 *      (exato ou fuzzy ≥0.7)
 *   2. Condômino principal da unidade (se tem telefone)
 *   3. Primeiro adicional ativo com telefone
 *   4. null — chama-se "sem destinatário"
 *
 * Substitui a `chooseRecipientSimple` da 4.3.
 */

export interface MoradorCandidate {
  id: string;
  nome: string;
  telefone: string;
  is_principal: boolean;
}

export type RecipientMatchedBy = 'nome_etiqueta' | 'principal' | 'fallback_adicional';

export interface Recipient {
  morador_id: string;
  nome: string;
  telefone: string;
  matched_by: RecipientMatchedBy;
}

/** Função pura — testável sem I/O. */
export function matchByName(
  extractedName: string | null | undefined,
  candidates: MoradorCandidate[],
): MoradorCandidate | null {
  const target = normalizeName(extractedName);
  if (!target) return null;

  // 1. Match exato (após normalização)
  for (const m of candidates) {
    if (!m.telefone || m.telefone.trim() === '') continue;
    if (normalizeName(m.nome) === target) return m;
  }

  // 2. Match fuzzy: primeiro+último nome batem OU similaridade ≥0.7
  let best: { morador: MoradorCandidate; score: number } | null = null;
  for (const m of candidates) {
    if (!m.telefone || m.telefone.trim() === '') continue;
    const score = nameSimilarity(m.nome, extractedName ?? '');
    if (score >= 0.7 && (!best || score > best.score)) {
      best = { morador: m, score };
    }
  }
  if (best) return best.morador;

  // 3. Match por primeiro+último nome (cobre "Maria Silva" vs "Maria da Silva")
  const targetFirstLast = firstLastNameKey(target);
  if (targetFirstLast) {
    for (const m of candidates) {
      if (!m.telefone || m.telefone.trim() === '') continue;
      const candidateKey = firstLastNameKey(normalizeName(m.nome));
      if (candidateKey === targetFirstLast) return m;
    }
  }

  return null;
}

function firstLastNameKey(normalized: string): string | null {
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]}|${parts[parts.length - 1]}`;
}

/**
 * Escolhe destinatário pra um pacote.
 * Bypassa RLS — caller (worker) é responsável pelo isolamento.
 */
export async function chooseRecipient(pacoteId: string): Promise<Recipient | null> {
  const pacote = await withSuperAdmin((tx) =>
    tx.pacote.findUnique({
      where: { id: pacoteId },
      select: {
        id: true,
        nome_destinatario_etiqueta: true,
        ia_extracao_raw: true,
        unidade: {
          select: {
            moradores: {
              where: { ativo: true, deleted_at: null },
              select: {
                id: true,
                nome: true,
                telefone: true,
                is_principal: true,
              },
            },
          },
        },
      },
    }),
  );

  if (!pacote || !pacote.unidade) return null;

  const moradores = pacote.unidade.moradores;
  const moradoresComTelefone = moradores.filter((m) => m.telefone && m.telefone.trim().length > 0);
  if (moradoresComTelefone.length === 0) return null;

  // Fonte do nome: campo persistido (preferência) > raw da IA
  const extractedName =
    pacote.nome_destinatario_etiqueta ?? extractNameFromRaw(pacote.ia_extracao_raw);

  // 1. Match por nome
  const nameMatch = matchByName(extractedName, moradoresComTelefone);
  if (nameMatch) {
    return {
      morador_id: nameMatch.id,
      nome: nameMatch.nome,
      telefone: nameMatch.telefone,
      matched_by: 'nome_etiqueta',
    };
  }

  // 2. Principal
  const principal = moradoresComTelefone.find((m) => m.is_principal);
  if (principal) {
    return {
      morador_id: principal.id,
      nome: principal.nome,
      telefone: principal.telefone,
      matched_by: 'principal',
    };
  }

  // 3. Primeiro adicional
  const fallback = moradoresComTelefone[0]!;
  return {
    morador_id: fallback.id,
    nome: fallback.nome,
    telefone: fallback.telefone,
    matched_by: 'fallback_adicional',
  };
}

function extractNameFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = obj.nome_destinatario;
  return typeof name === 'string' ? name : null;
}
