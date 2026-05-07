import { describe, it, expect } from 'vitest';
import { pacoteOrganizarInputSchema } from '@/lib/validators/pacote-organizar';

const UUID = '00000000-0000-4000-8000-000000000000';
const valid = { tamanho: 'medio' as const, setor_id: UUID, posicao: 'B-12' };

describe('pacoteOrganizarInputSchema', () => {
  it('aceita payload completo', () => {
    expect(() => pacoteOrganizarInputSchema.parse(valid)).not.toThrow();
  });

  it('aceita posicao null', () => {
    const out = pacoteOrganizarInputSchema.parse({ ...valid, posicao: null });
    expect(out.posicao).toBeNull();
  });

  it('posicao vazia vira null', () => {
    const out = pacoteOrganizarInputSchema.parse({ ...valid, posicao: '   ' });
    expect(out.posicao).toBeNull();
  });

  it('aceita todos os 4 tamanhos', () => {
    for (const t of ['pequeno', 'medio', 'grande', 'extra_grande'] as const) {
      expect(() =>
        pacoteOrganizarInputSchema.parse({ ...valid, tamanho: t }),
      ).not.toThrow();
    }
  });

  it('rejeita tamanho inválido', () => {
    expect(() =>
      pacoteOrganizarInputSchema.parse({ ...valid, tamanho: 'gigante' }),
    ).toThrow();
  });

  it('rejeita setor_id não-UUID', () => {
    expect(() =>
      pacoteOrganizarInputSchema.parse({ ...valid, setor_id: 'abc' }),
    ).toThrow();
  });

  it('rejeita posicao > 50 chars', () => {
    expect(() =>
      pacoteOrganizarInputSchema.parse({ ...valid, posicao: 'a'.repeat(51) }),
    ).toThrow();
  });

  it('rejeita setor_id ausente', () => {
    const { setor_id: _s, ...sem } = valid;
    expect(() => pacoteOrganizarInputSchema.parse(sem)).toThrow();
  });
});
