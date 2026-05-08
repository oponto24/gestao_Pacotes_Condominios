/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { matchByName, type MoradorCandidate } from '@/lib/whatsapp/recipient';

const MORADORES: MoradorCandidate[] = [
  { id: 'p', nome: 'Maria da Silva', telefone: '5511111111111', is_principal: true },
  { id: 'a1', nome: 'Pedro Costa', telefone: '5522222222222', is_principal: false },
  { id: 'a2', nome: 'José Santos', telefone: '', is_principal: false },
  { id: 'a3', nome: 'João Carlos Souza', telefone: '5533333333333', is_principal: false },
];

describe('matchByName', () => {
  it('match exato após normalização', () => {
    expect(matchByName('Pedro Costa', MORADORES)?.id).toBe('a1');
  });

  it('match fuzzy: "Maria Silva" → "Maria da Silva"', () => {
    expect(matchByName('Maria Silva', MORADORES)?.id).toBe('p');
  });

  it('match por primeiro+último: "JOÃO SOUZA" → "João Carlos Souza"', () => {
    expect(matchByName('JOÃO SOUZA', MORADORES)?.id).toBe('a3');
  });

  it('ignora morador sem telefone mesmo com nome match (José Santos)', () => {
    expect(matchByName('Jose Santos', MORADORES)).toBeNull();
  });

  it('acentos e caixa não importam: "JOSÉ" não bate sem telefone', () => {
    // Mesmo se José tivesse telefone, o teste anterior já cobre. Aqui valida normalização.
    const ativo: MoradorCandidate[] = [
      { id: 'j', nome: 'José', telefone: '5544444444444', is_principal: false },
    ];
    expect(matchByName('JOSE', ativo)?.id).toBe('j');
    expect(matchByName('jose', ativo)?.id).toBe('j');
  });

  it('retorna null quando nome não casa com ninguém', () => {
    expect(matchByName('Fulano de Tal Inexistente', MORADORES)).toBeNull();
  });

  it('retorna null quando nome extraído vazio/null', () => {
    expect(matchByName(null, MORADORES)).toBeNull();
    expect(matchByName('', MORADORES)).toBeNull();
    expect(matchByName('   ', MORADORES)).toBeNull();
  });

  it('rejeita match de nomes muito diferentes: "Roberto Almeida" vs "Pedro Costa"', () => {
    const m: MoradorCandidate[] = [
      { id: 'a', nome: 'Pedro Costa', telefone: '5511111111111', is_principal: false },
    ];
    expect(matchByName('Roberto Almeida', m)).toBeNull();
  });

  it('retorna primeiro match no exato antes de fuzzy', () => {
    const m: MoradorCandidate[] = [
      { id: 'fuzzy', nome: 'Pedro Souza', telefone: '5511111111111', is_principal: false },
      { id: 'exact', nome: 'Pedro', telefone: '5522222222222', is_principal: false },
    ];
    expect(matchByName('Pedro', m)?.id).toBe('exact');
  });
});
