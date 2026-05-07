/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { normalizarNome } from '@/lib/text/normalize';

describe('normalizarNome', () => {
  it('aplica lowercase', () => {
    expect(normalizarNome('JOÃO DA SILVA')).toBe('joao da silva');
  });

  it('remove acentos comuns BR', () => {
    expect(normalizarNome('João')).toBe('joao');
    expect(normalizarNome('Conceição')).toBe('conceicao');
    // ÁÉÍÓÚ(5) áéíóú(5) âêîôû(5) ãõ(2) ç(1) ÀÈÌÒÙ(5) = 23 chars
    expect(normalizarNome('ÁÉÍÓÚáéíóúâêîôûãõçÀÈÌÒÙ')).toBe('aeiouaeiouaeiouaocaeiou');
  });

  it('trim + colapsa espaços múltiplos', () => {
    expect(normalizarNome('  João   da    Silva  ')).toBe('joao da silva');
  });

  it('string vazia retorna ""', () => {
    expect(normalizarNome('')).toBe('');
    expect(normalizarNome('   ')).toBe('');
  });

  it('mantém dígitos e hífen (nomes compostos)', () => {
    expect(normalizarNome('José-Maria 2º')).toBe('jose-maria 2º');
  });
});
