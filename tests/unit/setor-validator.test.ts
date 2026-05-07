/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  setorCreateSchema,
  setorUpdateSchema,
  setorListQuerySchema,
} from '@/lib/validators/setor';

describe('setorCreateSchema', () => {
  it('aceita payload mínimo (apenas nome)', () => {
    const result = setorCreateSchema.parse({ nome: 'Bloco A' });
    expect(result.nome).toBe('Bloco A');
    expect(result.descricao).toBeUndefined();
    expect(result.capacidade).toBeUndefined();
  });

  it('aceita payload completo + coerce de capacidade string→number', () => {
    const result = setorCreateSchema.parse({
      nome: 'Salão',
      descricao: 'Festas',
      capacidade: '50',
    });
    expect(result.capacidade).toBe(50);
  });

  it('rejeita nome vazio', () => {
    const result = setorCreateSchema.safeParse({ nome: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita capacidade negativa', () => {
    const result = setorCreateSchema.safeParse({ nome: 'X', capacidade: -1 });
    expect(result.success).toBe(false);
  });

  it('descricao vazia vira undefined', () => {
    const result = setorCreateSchema.parse({ nome: 'X', descricao: '' });
    expect(result.descricao).toBeUndefined();
  });
});

describe('setorUpdateSchema', () => {
  it('aceita partial + ativo boolean', () => {
    const result = setorUpdateSchema.parse({ ativo: false });
    expect(result.ativo).toBe(false);
    expect(result.nome).toBeUndefined();
  });
});

describe('setorListQuerySchema', () => {
  it('aplica defaults', () => {
    const result = setorListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.include_inativos).toBe(false);
  });

  it('parse include_inativos=true', () => {
    const result = setorListQuerySchema.parse({ include_inativos: 'true' });
    expect(result.include_inativos).toBe(true);
  });
});
