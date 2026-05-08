import { describe, it, expect } from 'vitest';
import { labelExtractionSchema } from '@/lib/ai/schemas/label-extraction';

describe('labelExtractionSchema', () => {
  const minimalValid = { confianca: 0.5 };

  it('aceita resposta mínima (apenas confianca)', () => {
    const out = labelExtractionSchema.parse(minimalValid);
    expect(out.confianca).toBe(0.5);
  });

  it('aceita resposta completa', () => {
    const out = labelExtractionSchema.parse({
      nome_destinatario: 'Maria Silva',
      endereco: 'Rua das Flores, 123',
      cep: '74650-100',
      complemento: 'AP 1304',
      transportadora: 'correios',
      remetente: 'Loja XYZ',
      confianca: 0.95,
    });
    expect(out.nome_destinatario).toBe('Maria Silva');
    expect(out.transportadora).toBe('correios');
  });

  it('normaliza CEP sem hífen para com hífen', () => {
    const out = labelExtractionSchema.parse({ ...minimalValid, cep: '74650100' });
    expect(out.cep).toBe('74650-100');
  });

  it('aceita CEP já com hífen', () => {
    const out = labelExtractionSchema.parse({ ...minimalValid, cep: '01310-100' });
    expect(out.cep).toBe('01310-100');
  });

  it('normaliza transportadora desconhecida para "outro" (tolerante)', () => {
    const out = labelExtractionSchema.parse({
      ...minimalValid,
      transportadora: 'fedex',
    });
    expect(out.transportadora).toBe('outro');
  });

  it('aceita transportadora nova (tiktok_shop / imile)', () => {
    const a = labelExtractionSchema.parse({
      ...minimalValid,
      transportadora: 'tiktok_shop',
    });
    expect(a.transportadora).toBe('tiktok_shop');
    const b = labelExtractionSchema.parse({ ...minimalValid, transportadora: 'imile' });
    expect(b.transportadora).toBe('imile');
  });

  it('aceita transportadora null', () => {
    const out = labelExtractionSchema.parse({ ...minimalValid, transportadora: null });
    expect(out.transportadora).toBeNull();
  });

  it('rejeita confianca > 1', () => {
    expect(() => labelExtractionSchema.parse({ confianca: 1.5 })).toThrow();
  });

  it('rejeita confianca < 0', () => {
    expect(() => labelExtractionSchema.parse({ confianca: -0.1 })).toThrow();
  });

  it('strings vazias viram null', () => {
    const out = labelExtractionSchema.parse({
      ...minimalValid,
      nome_destinatario: '',
      endereco: '   ',
    });
    expect(out.nome_destinatario).toBeNull();
    expect(out.endereco).toBeNull();
  });

  it('CEP malformado (≠8 dígitos) vira null em vez de rejeitar (tolerante)', () => {
    const a = labelExtractionSchema.parse({ ...minimalValid, cep: '12345' });
    expect(a.cep).toBeNull();
    const b = labelExtractionSchema.parse({ ...minimalValid, cep: '024010' });
    expect(b.cep).toBeNull();
    const c = labelExtractionSchema.parse({ ...minimalValid, cep: '02403' });
    expect(c.cep).toBeNull();
  });
});
