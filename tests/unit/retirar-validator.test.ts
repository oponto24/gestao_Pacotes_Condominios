import { describe, it, expect } from 'vitest';
import {
  retirarIniciarSchema,
  retirarConfirmarSchema,
} from '@/lib/validators/retirar';

describe('retirarIniciarSchema', () => {
  it('aceita token válido', () => {
    expect(() =>
      retirarIniciarSchema.parse({ qr_token: 'abc123def456ghi789' }),
    ).not.toThrow();
  });

  it('rejeita curto', () => {
    expect(() => retirarIniciarSchema.parse({ qr_token: 'abc' })).toThrow();
  });

  it('rejeita chars inválidos', () => {
    expect(() =>
      retirarIniciarSchema.parse({ qr_token: 'abc 123 def 456' }),
    ).toThrow();
  });
});

describe('retirarConfirmarSchema', () => {
  it('aceita próprio destinatário sem nome', () => {
    expect(() =>
      retirarConfirmarSchema.parse({
        proprio_destinatario: true,
        retirado_por_terceiro: null,
      }),
    ).not.toThrow();
  });

  it('aceita terceiro com nome', () => {
    const out = retirarConfirmarSchema.parse({
      proprio_destinatario: false,
      retirado_por_terceiro: 'Maria Silva',
    });
    expect(out.retirado_por_terceiro).toBe('Maria Silva');
  });

  it('rejeita terceiro sem nome', () => {
    expect(() =>
      retirarConfirmarSchema.parse({
        proprio_destinatario: false,
        retirado_por_terceiro: null,
      }),
    ).toThrow();
  });

  it('rejeita terceiro com nome curto', () => {
    expect(() =>
      retirarConfirmarSchema.parse({
        proprio_destinatario: false,
        retirado_por_terceiro: 'AB',
      }),
    ).toThrow();
  });

  it('terceiro string vazia vira null e falha', () => {
    expect(() =>
      retirarConfirmarSchema.parse({
        proprio_destinatario: false,
        retirado_por_terceiro: '   ',
      }),
    ).toThrow();
  });

  it('rejeita nome > 200', () => {
    expect(() =>
      retirarConfirmarSchema.parse({
        proprio_destinatario: false,
        retirado_por_terceiro: 'a'.repeat(201),
      }),
    ).toThrow();
  });

  it('aceita próprio com terceiro null', () => {
    const out = retirarConfirmarSchema.parse({
      proprio_destinatario: true,
      retirado_por_terceiro: null,
    });
    expect(out.retirado_por_terceiro).toBeNull();
  });
});
