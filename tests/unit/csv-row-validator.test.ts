import { describe, it, expect } from 'vitest';
import { csvRowSchema } from '@/lib/validators/csv-import';

describe('csvRowSchema', () => {
  const base = {
    bloco: 'A',
    identificador: '101',
    morador_nome: 'João Silva',
    morador_telefone: '(11) 98765-4321',
    morador_email: 'joao@test.com',
  };

  it('aceita payload mínimo + normaliza telefone para E.164', () => {
    const out = csvRowSchema.parse(base);
    expect(out.morador_telefone).toBe('+5511987654321');
    expect(out.bloco).toBe('A');
    expect(out.identificador).toBe('101');
  });

  it('aceita bloco vazio (sem bloco) → undefined', () => {
    const out = csvRowSchema.parse({ ...base, bloco: '' });
    expect(out.bloco).toBeUndefined();
  });

  it('aceita morador_email vazio → undefined', () => {
    const out = csvRowSchema.parse({ ...base, morador_email: '' });
    expect(out.morador_email).toBeUndefined();
  });

  it('rejeita telefone inválido', () => {
    expect(() => csvRowSchema.parse({ ...base, morador_telefone: 'abc' })).toThrow();
  });

  it('rejeita nome curto (<3 chars)', () => {
    expect(() => csvRowSchema.parse({ ...base, morador_nome: 'Jo' })).toThrow();
  });

  it('rejeita identificador vazio', () => {
    expect(() => csvRowSchema.parse({ ...base, identificador: '' })).toThrow();
  });

  it('rejeita email malformado', () => {
    expect(() => csvRowSchema.parse({ ...base, morador_email: 'not-an-email' })).toThrow();
  });

  it('aceita telefone já em E.164', () => {
    const out = csvRowSchema.parse({ ...base, morador_telefone: '+5511987654321' });
    expect(out.morador_telefone).toBe('+5511987654321');
  });

  it('faz trim em todos os campos string', () => {
    const out = csvRowSchema.parse({
      ...base,
      bloco: '  A  ',
      identificador: ' 101 ',
      morador_nome: '  João  ',
    });
    expect(out.bloco).toBe('A');
    expect(out.identificador).toBe('101');
    expect(out.morador_nome).toBe('João');
  });
});
