import { describe, it, expect } from 'vitest';
import { pacoteConfirmarInputSchema } from '@/lib/validators/pacote-confirmar';

const UUID = '00000000-0000-4000-8000-000000000000';

const valid = {
  nome_destinatario: 'João Silva',
  endereco: 'Rua das Flores, 123',
  cep: '74650-100',
  complemento: 'AP 1304',
  remetente: 'Loja XYZ',
  unidade_id: UUID,
  destinatario_id: UUID,
};

describe('pacoteConfirmarInputSchema', () => {
  it('aceita payload válido completo', () => {
    expect(() => pacoteConfirmarInputSchema.parse(valid)).not.toThrow();
  });

  it('aceita destinatario_id null (outra pessoa)', () => {
    const out = pacoteConfirmarInputSchema.parse({ ...valid, destinatario_id: null });
    expect(out.destinatario_id).toBeNull();
  });

  it('rejeita nome_destinatario vazio', () => {
    expect(() =>
      pacoteConfirmarInputSchema.parse({ ...valid, nome_destinatario: '' }),
    ).toThrow();
  });

  it('rejeita nome > 200 chars', () => {
    expect(() =>
      pacoteConfirmarInputSchema.parse({
        ...valid,
        nome_destinatario: 'a'.repeat(201),
      }),
    ).toThrow();
  });

  it('aceita endereco null', () => {
    const out = pacoteConfirmarInputSchema.parse({ ...valid, endereco: null });
    expect(out.endereco).toBeNull();
  });

  it('endereco vazio vira null (preprocess)', () => {
    const out = pacoteConfirmarInputSchema.parse({ ...valid, endereco: '   ' });
    expect(out.endereco).toBeNull();
  });

  it('aceita CEP sem hífen', () => {
    const out = pacoteConfirmarInputSchema.parse({ ...valid, cep: '74650100' });
    expect(out.cep).toBe('74650100');
  });

  it('rejeita CEP com formato errado', () => {
    expect(() =>
      pacoteConfirmarInputSchema.parse({ ...valid, cep: '12345' }),
    ).toThrow();
  });

  it('CEP vazio vira null', () => {
    const out = pacoteConfirmarInputSchema.parse({ ...valid, cep: '' });
    expect(out.cep).toBeNull();
  });

  it('rejeita unidade_id não-UUID', () => {
    expect(() =>
      pacoteConfirmarInputSchema.parse({ ...valid, unidade_id: 'not-uuid' }),
    ).toThrow();
  });

  it('rejeita destinatario_id não-UUID e não-null', () => {
    expect(() =>
      pacoteConfirmarInputSchema.parse({ ...valid, destinatario_id: 'not-uuid' }),
    ).toThrow();
  });

  it('rejeita unidade_id ausente', () => {
    const { unidade_id: _u, ...semUnidade } = valid;
    expect(() => pacoteConfirmarInputSchema.parse(semUnidade)).toThrow();
  });
});
