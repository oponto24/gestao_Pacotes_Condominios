/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { parsePalavraChave } from '@/lib/whatsapp/parse-palavra-chave';

describe('parsePalavraChave', () => {
  // --- Padrões com prefixo numérico ---
  it('extrai código de "Código 123456 liquidificador"', () => {
    const result = parsePalavraChave('Código 123456 liquidificador');
    expect(result?.codigo).toBe('123456');
    expect(result?.descricao).toContain('liquidificador');
  });

  it('aceita acentuação e variações de prefixo', () => {
    expect(parsePalavraChave('codigo 4567')?.codigo).toBe('4567');
    expect(parsePalavraChave('CÓDIGO: 9876')?.codigo).toBe('9876');
    expect(parsePalavraChave('palavra-chave 1234')?.codigo).toBe('1234');
    expect(parsePalavraChave('chave 5555')?.codigo).toBe('5555');
  });

  it('extrai prefixo ML', () => {
    expect(parsePalavraChave('ML 654321')?.codigo).toBe('654321');
    expect(parsePalavraChave('ml: 999000')?.codigo).toBe('999000');
  });

  // --- Padrões alfanuméricos com prefixo (story 7.5) ---
  it('extrai "código FACA"', () => {
    const result = parsePalavraChave('código FACA');
    expect(result?.codigo).toBe('FACA');
  });

  it('extrai "chave ABC123"', () => {
    expect(parsePalavraChave('chave ABC123')?.codigo).toBe('ABC123');
  });

  it('extrai "palavra chave mesa123"', () => {
    expect(parsePalavraChave('palavra chave mesa123')?.codigo).toBe('MESA123');
  });

  // --- Mensagens curtas como keyword direta (story 7.5) ---
  it('mensagem curta alfanumérica é tratada como keyword', () => {
    expect(parsePalavraChave('FACA')?.codigo).toBe('FACA');
    expect(parsePalavraChave('mesa123')?.codigo).toBe('MESA123');
    expect(parsePalavraChave('  ABC  ')?.codigo).toBe('ABC');
  });

  it('extrai dígitos isolados em mensagem curta', () => {
    expect(parsePalavraChave('123456')?.codigo).toBe('123456');
    expect(parsePalavraChave('  9999  ')?.codigo).toBe('9999');
  });

  // --- Rejeições ---
  it('rejeita saudações comuns', () => {
    expect(parsePalavraChave('oi')).toBeNull();
    expect(parsePalavraChave('Olá')).toBeNull();
    expect(parsePalavraChave('Bom dia')).toBeNull();
    expect(parsePalavraChave('boa tarde')).toBeNull();
    expect(parsePalavraChave('boa noite')).toBeNull();
    expect(parsePalavraChave('obrigado')).toBeNull();
    expect(parsePalavraChave('valeu')).toBeNull();
    expect(parsePalavraChave('ok')).toBeNull();
    expect(parsePalavraChave('sim')).toBeNull();
    expect(parsePalavraChave('não')).toBeNull();
    expect(parsePalavraChave('blz')).toBeNull();
  });

  it('rejeita mensagens vazias', () => {
    expect(parsePalavraChave('')).toBeNull();
    expect(parsePalavraChave('   ')).toBeNull();
  });

  it('rejeita mensagens longas sem prefixo', () => {
    expect(parsePalavraChave('Olá, gostaria de saber sobre meu pacote que chegou ontem à tarde')).toBeNull();
  });

  it('ML com poucos dígitos cai no short-message fallback', () => {
    // ML regex exige 4-10 dígitos, mas "ML 123" é curta o bastante
    // para ser tratada como keyword direta pelo fallback
    const result = parsePalavraChave('ML 123');
    expect(result).not.toBeNull();
    expect(result?.codigo).toBe('ML 123');
  });

  it('ML com muitos dígitos cai no short-message fallback', () => {
    const result = parsePalavraChave('ML 12345678901');
    expect(result).not.toBeNull();
    expect(result?.codigo).toBe('ML 12345678901');
  });

  // --- Descrição ---
  it('extrai descrição limpa', () => {
    const result = parsePalavraChave('codigo 12345 - bola de futebol');
    expect(result?.codigo).toBe('12345');
    expect(result?.descricao).toMatch(/bola de futebol/i);
  });

  it('descrição null quando texto auxiliar é mínimo', () => {
    expect(parsePalavraChave('123456')?.descricao).toBeNull();
  });

  it('descrição null para keyword direta', () => {
    expect(parsePalavraChave('FACA')?.descricao).toBeNull();
  });
});
