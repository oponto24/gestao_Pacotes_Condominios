import { describe, it, expect } from 'vitest';
import { pacoteCreateInputSchema } from '@/lib/validators/pacote-create';

describe('pacoteCreateInputSchema', () => {
  it('aceita payload vazio', () => {
    const out = pacoteCreateInputSchema.parse({});
    expect(out.codigo_rastreio).toBeUndefined();
  });

  it('aceita codigo_rastreio típico Correios', () => {
    const out = pacoteCreateInputSchema.parse({ codigo_rastreio: 'AD417365859BR' });
    expect(out.codigo_rastreio).toBe('AD417365859BR');
  });

  it('aceita código com hífen e ponto', () => {
    const out = pacoteCreateInputSchema.parse({ codigo_rastreio: 'ML-2024.1234' });
    expect(out.codigo_rastreio).toBe('ML-2024.1234');
  });

  it('trim aplicado', () => {
    const out = pacoteCreateInputSchema.parse({ codigo_rastreio: '  ABC123  ' });
    expect(out.codigo_rastreio).toBe('ABC123');
  });

  it('string vazia → undefined (preprocess)', () => {
    const out = pacoteCreateInputSchema.parse({ codigo_rastreio: '' });
    expect(out.codigo_rastreio).toBeUndefined();
  });

  it('rejeita > 100 chars', () => {
    expect(() =>
      pacoteCreateInputSchema.parse({ codigo_rastreio: 'A'.repeat(101) }),
    ).toThrow();
  });

  it('rejeita caracteres especiais (SQL injection attempt)', () => {
    expect(() =>
      pacoteCreateInputSchema.parse({ codigo_rastreio: "'; DROP TABLE--" }),
    ).toThrow();
  });

  it('rejeita emoji ou unicode exótico', () => {
    expect(() => pacoteCreateInputSchema.parse({ codigo_rastreio: '📦123' })).toThrow();
  });
});
