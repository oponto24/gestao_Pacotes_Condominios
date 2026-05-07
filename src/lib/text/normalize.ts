/**
 * Normalização de strings para matching (busca, comparação fuzzy, IA).
 *
 * `normalizarNome` é usado em:
 * - Story 2.4: cálculo de `morador.nome_normalizado` antes do save
 * - Story 3.7 (futuro): matching IA-extraído ↔ morador via nome
 *
 * Estratégia:
 * - Lowercase
 * - Remove acentos via NFD decompose + filter de combining marks
 * - Trim + colapsa espaços múltiplos para 1
 *
 * Mantém: dígitos, hífens, sublinhados (caso úteis em nomes compostos).
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove combining marks (acentos decompostos)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // colapsa espaços múltiplos
}
