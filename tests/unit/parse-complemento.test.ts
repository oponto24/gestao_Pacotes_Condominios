import { describe, it, expect } from 'vitest';
import { parseComplemento } from '@/lib/matching/parse-complemento';

describe('parseComplemento', () => {
  it('AP 1304', () => {
    expect(parseComplemento('AP 1304')).toEqual({ apto: '1304', bloco: null });
  });

  it('Apto 301-B', () => {
    expect(parseComplemento('Apto 301-B')).toEqual({ apto: '301', bloco: 'B' });
  });

  it('Apartamento 12 Bloco 3', () => {
    expect(parseComplemento('Apartamento 12 Bloco 3')).toEqual({
      apto: '12',
      bloco: '3',
    });
  });

  it('Bloco A Apto 1304', () => {
    expect(parseComplemento('Bloco A Apto 1304')).toEqual({
      apto: '1304',
      bloco: 'A',
    });
  });

  it('Torre 2 Apto 502', () => {
    expect(parseComplemento('Torre 2 Apto 502')).toEqual({
      apto: '502',
      bloco: '2',
    });
  });

  it('Casa 5', () => {
    expect(parseComplemento('Casa 5')).toEqual({ apto: '5', bloco: null });
  });

  it('Apto. 401', () => {
    expect(parseComplemento('Apto. 401')).toEqual({ apto: '401', bloco: null });
  });

  it('Bl 3 Ap 102', () => {
    expect(parseComplemento('Bl 3 Ap 102')).toEqual({ apto: '102', bloco: '3' });
  });

  it('Quadra 7 Casa 12', () => {
    expect(parseComplemento('Quadra 7 Casa 12')).toEqual({
      apto: '12',
      bloco: '7',
    });
  });

  it('lowercase também funciona', () => {
    expect(parseComplemento('apto 1304 bloco 3')).toEqual({
      apto: '1304',
      bloco: '3',
    });
  });

  it('número solto fallback', () => {
    expect(parseComplemento('1304')).toEqual({ apto: '1304', bloco: null });
  });

  it('null/empty', () => {
    expect(parseComplemento(null)).toBeNull();
    expect(parseComplemento('')).toBeNull();
    expect(parseComplemento('   ')).toBeNull();
  });

  it('texto sem padrão reconhecível', () => {
    expect(parseComplemento('xyz random texto')).toBeNull();
  });

  it('apto alfanumérico', () => {
    expect(parseComplemento('AP 12A')).toEqual({ apto: '12A', bloco: null });
  });

  it('AP-1304', () => {
    expect(parseComplemento('AP-1304')).toEqual({ apto: '1304', bloco: null });
  });

  it('preserva caso original em uppercase no output', () => {
    expect(parseComplemento('apto a-1')?.apto).toBe('A-1');
  });
});
