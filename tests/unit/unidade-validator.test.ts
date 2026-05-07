/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  unidadeCreateSchema,
  unidadeUpdateSchema,
  unidadeListQuerySchema,
} from '@/lib/validators/unidade';

describe('unidadeCreateSchema', () => {
  it('aceita payload mínimo (apenas identificador)', () => {
    const result = unidadeCreateSchema.parse({ identificador: '101' });
    expect(result.identificador).toBe('101');
    expect(result.bloco).toBeUndefined();
    expect(result.observacoes).toBeUndefined();
  });

  it('aceita payload completo', () => {
    const result = unidadeCreateSchema.parse({
      identificador: 'Apto 301-B',
      bloco: 'A',
      observacoes: 'Frente',
    });
    expect(result.bloco).toBe('A');
  });

  it('rejeita identificador vazio', () => {
    const result = unidadeCreateSchema.safeParse({ identificador: '' });
    expect(result.success).toBe(false);
  });

  it('bloco vazio vira undefined (preprocess)', () => {
    const result = unidadeCreateSchema.parse({ identificador: '101', bloco: '' });
    expect(result.bloco).toBeUndefined();
  });

  it('rejeita observações > 500 chars', () => {
    const result = unidadeCreateSchema.safeParse({
      identificador: '101',
      observacoes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('unidadeUpdateSchema', () => {
  it('aceita partial + ativo boolean', () => {
    const result = unidadeUpdateSchema.parse({ ativo: false });
    expect(result.ativo).toBe(false);
  });
});

describe('unidadeListQuerySchema', () => {
  it('aplica defaults + max pageSize 200', () => {
    const result = unidadeListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.include_inativas).toBe(false);
  });

  it('rejeita pageSize > 200', () => {
    const result = unidadeListQuerySchema.safeParse({ pageSize: '500' });
    expect(result.success).toBe(false);
  });
});
