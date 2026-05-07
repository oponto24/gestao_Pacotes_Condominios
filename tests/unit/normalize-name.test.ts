import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  nameSimilarity,
  nameMatches,
} from '@/lib/matching/normalize-name';

describe('normalizeName', () => {
  it('remove acentos', () => {
    expect(normalizeName('João Silva')).toBe('joao silva');
    expect(normalizeName('Conceição')).toBe('conceicao');
  });

  it('lowercase + comprime espaços', () => {
    expect(normalizeName('  MARIA   da SILVA  ')).toBe('maria da silva');
  });

  it('pontuação vira espaço', () => {
    expect(normalizeName('Maria, Silva.')).toBe('maria silva');
    expect(normalizeName('Dr. José-Antonio')).toBe('dr jose antonio');
  });

  it('null/empty', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName('')).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('nameSimilarity', () => {
  it('idêntico = 1', () => {
    expect(nameSimilarity('João Silva', 'João Silva')).toBe(1);
  });

  it('só diferença de acento ≈ 1', () => {
    expect(nameSimilarity('João Silva', 'Joao Silva')).toBe(1);
  });

  it('typo simples ≥ 0.85', () => {
    expect(nameSimilarity('João Silva', 'Joao Silvva')).toBeGreaterThanOrEqual(0.85);
  });

  it('sobrenome parecido ≥ 0.7', () => {
    expect(nameSimilarity('João Silva', 'João Silveira')).toBeGreaterThanOrEqual(0.7);
  });

  it('nomes diferentes < 0.5', () => {
    expect(nameSimilarity('João Silva', 'Maria Costa')).toBeLessThan(0.5);
  });

  it('vazio vs algo = 0', () => {
    expect(nameSimilarity('', 'João')).toBe(0);
  });

  it('ambos vazios = 1', () => {
    expect(nameSimilarity('', '')).toBe(1);
  });
});

describe('nameMatches', () => {
  it('threshold default 0.7', () => {
    expect(nameMatches('João Silva', 'Joao Silva')).toBe(true);
    expect(nameMatches('João Silva', 'Maria Costa')).toBe(false);
  });

  it('threshold custom', () => {
    expect(nameMatches('João Silva', 'João Silveira', 0.6)).toBe(true);
    expect(nameMatches('João Silva', 'João Silveira', 0.95)).toBe(false);
  });
});
