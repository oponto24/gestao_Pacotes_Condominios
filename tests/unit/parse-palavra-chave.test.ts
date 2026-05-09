/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { parsePalavraChave } from '@/lib/whatsapp/parse-palavra-chave';

describe('parsePalavraChave', () => {
  it('extrai código de "Código 123456 liquidificador"', () => {
    const result = parsePalavraChave('Código 123456 liquidificador');
    expect(result?.codigo).toBe('123456');
    expect(result?.descricao).toContain('liquidificador');
  });

  it('aceita acentuação e variações', () => {
    expect(parsePalavraChave('codigo 4567')?.codigo).toBe('4567');
    expect(parsePalavraChave('CÓDIGO: 9876')?.codigo).toBe('9876');
    expect(parsePalavraChave('palavra-chave 1234')?.codigo).toBe('1234');
    expect(parsePalavraChave('chave 5555')?.codigo).toBe('5555');
  });

  it('extrai prefixo ML', () => {
    expect(parsePalavraChave('ML 654321')?.codigo).toBe('654321');
    expect(parsePalavraChave('ml: 999000')?.codigo).toBe('999000');
  });

  it('extrai dígitos isolados em mensagem curta', () => {
    expect(parsePalavraChave('123456')?.codigo).toBe('123456');
    expect(parsePalavraChave('  9999  ')?.codigo).toBe('9999');
  });

  it('rejeita mensagens sem dígitos', () => {
    expect(parsePalavraChave('oi tudo bem')).toBeNull();
    expect(parsePalavraChave('')).toBeNull();
    expect(parsePalavraChave('   ')).toBeNull();
  });

  it('rejeita códigos muito curtos (<4 dígitos)', () => {
    expect(parsePalavraChave('codigo 123')).toBeNull();
  });

  it('rejeita códigos muito longos (>10 dígitos)', () => {
    expect(parsePalavraChave('codigo 12345678901')).toBeNull();
  });

  it('extrai descrição limpa', () => {
    const result = parsePalavraChave('codigo 12345 - bola de futebol');
    expect(result?.codigo).toBe('12345');
    expect(result?.descricao).toMatch(/bola de futebol/i);
  });

  it('descrição null quando texto auxiliar é mínimo', () => {
    expect(parsePalavraChave('123456')?.descricao).toBeNull();
  });
});
