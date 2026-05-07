/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  moradorCreateSchema,
  moradorUpdateSchema,
  moradorListQuerySchema,
} from '@/lib/validators/morador';

// UUID v4 válido (4 no início do 3º grupo, 8/9/a/b no 4º — RFC 4122)
const VALID_UUID = 'a1b2c3d4-1234-4abc-8def-123456789abc';
const validBase = {
  nome: 'João da Silva',
  telefone: '(11) 98765-4321',
  unidade_id: VALID_UUID,
};

describe('moradorCreateSchema', () => {
  it('aceita payload mínimo + normaliza telefone para E.164', () => {
    const result = moradorCreateSchema.parse(validBase);
    expect(result.telefone).toBe('+5511987654321');
    expect(result.is_principal).toBe(false); // default
    expect(result.email).toBeUndefined();
  });

  it('aceita is_principal=true', () => {
    const result = moradorCreateSchema.parse({ ...validBase, is_principal: true });
    expect(result.is_principal).toBe(true);
  });

  it('email vazio vira undefined', () => {
    const result = moradorCreateSchema.parse({ ...validBase, email: '' });
    expect(result.email).toBeUndefined();
  });

  it('rejeita telefone formato livre', () => {
    const result = moradorCreateSchema.safeParse({ ...validBase, telefone: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejeita unidade_id não-UUID', () => {
    const result = moradorCreateSchema.safeParse({ ...validBase, unidade_id: 'not-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/UUID/);
    }
  });

  it('rejeita nome curto demais', () => {
    const result = moradorCreateSchema.safeParse({ ...validBase, nome: 'Jo' });
    expect(result.success).toBe(false);
  });
});

describe('moradorUpdateSchema', () => {
  it('aceita partial sem unidade_id (PATCH não permite mover)', () => {
    const result = moradorUpdateSchema.parse({ nome: 'Novo Nome', ativo: false });
    expect(result.nome).toBe('Novo Nome');
    expect(result.ativo).toBe(false);
  });

  it('schema NÃO tem campo unidade_id (defesa contra escape)', () => {
    // Campo unidade_id passa por strip silencioso pelo Zod (default behavior)
    const result = moradorUpdateSchema.parse({
      nome: 'Nome Válido',
      // @ts-expect-error — testando que campo é stripado
      unidade_id: 'qualquer-coisa',
    });
    expect((result as Record<string, unknown>).unidade_id).toBeUndefined();
  });
});

describe('moradorListQuerySchema', () => {
  it('aplica defaults', () => {
    const result = moradorListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.include_inativos).toBe(false);
    expect(result.include_arquivados).toBe(false);
  });

  it('filtro unidade_id opcional', () => {
    const result = moradorListQuerySchema.parse({ unidade_id: VALID_UUID });
    expect(result.unidade_id).toBe(VALID_UUID);
  });
});
