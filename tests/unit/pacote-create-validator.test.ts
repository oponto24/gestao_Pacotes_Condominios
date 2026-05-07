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

  it('rejeita > 200 chars', () => {
    expect(() =>
      pacoteCreateInputSchema.parse({ codigo_rastreio: 'A'.repeat(201) }),
    ).toThrow();
  });

  it('aceita QR Code com JSON (uso real de marketplace)', () => {
    const out = pacoteCreateInputSchema.parse({
      codigo_rastreio: '{"id":"46972841780","t":"lm"}',
    });
    expect(out.codigo_rastreio).toBe('{"id":"46972841780","t":"lm"}');
  });

  it('aceita QR Code com URL', () => {
    const out = pacoteCreateInputSchema.parse({
      codigo_rastreio: 'https://wa.me/qr/4C5VTKUCNLZEO1',
    });
    expect(out.codigo_rastreio).toBe('https://wa.me/qr/4C5VTKUCNLZEO1');
  });

  it('aceita SQL injection literal (Prisma protege com prepared statements)', () => {
    const out = pacoteCreateInputSchema.parse({
      codigo_rastreio: "'; DROP TABLE--",
    });
    expect(out.codigo_rastreio).toBe("'; DROP TABLE--");
  });

  it('rejeita < e > (defesa XSS)', () => {
    expect(() =>
      pacoteCreateInputSchema.parse({ codigo_rastreio: '<script>' }),
    ).toThrow();
    expect(() =>
      pacoteCreateInputSchema.parse({ codigo_rastreio: 'a<b' }),
    ).toThrow();
  });

  it('rejeita emoji ou unicode não-ASCII', () => {
    expect(() => pacoteCreateInputSchema.parse({ codigo_rastreio: '📦123' })).toThrow();
  });
});
