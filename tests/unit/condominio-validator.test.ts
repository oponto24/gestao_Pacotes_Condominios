/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  condominioCreateSchema,
  condominioUpdateSchema,
  condominioListQuerySchema,
} from '@/lib/validators/condominio';

const VALID_PAYLOAD = {
  nome: 'Edifício Aurora',
  cnpj: '00.000.000/0001-91',
  endereco: 'Rua das Flores, 123',
  cep: '01000-000',
  cidade: 'São Paulo',
  estado: 'SP',
  contato_nome: 'Maria da Silva',
  contato_telefone: '(11) 99999-9999',
  contato_email: 'sindico@example.com',
};

describe('condominioCreateSchema', () => {
  it('aceita payload completo válido + normaliza CNPJ/CEP/telefone', () => {
    const result = condominioCreateSchema.parse(VALID_PAYLOAD);
    expect(result.cnpj).toBe('00000000000191'); // sem pontuação
    expect(result.cep).toBe('01000000');
    expect(result.contato_telefone).toBe('+5511999999999'); // E.164
  });

  it('aceita CNPJ vazio (string) como undefined', () => {
    const result = condominioCreateSchema.parse({ ...VALID_PAYLOAD, cnpj: '' });
    expect(result.cnpj).toBeUndefined();
  });

  it('rejeita CEP em formato inválido com mensagem PT-BR', () => {
    const result = condominioCreateSchema.safeParse({ ...VALID_PAYLOAD, cep: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/CEP inválido/);
    }
  });

  it('rejeita CNPJ em formato inválido', () => {
    const result = condominioCreateSchema.safeParse({ ...VALID_PAYLOAD, cnpj: 'XYZ' });
    expect(result.success).toBe(false);
  });

  it('rejeita estado lowercase', () => {
    const result = condominioCreateSchema.safeParse({ ...VALID_PAYLOAD, estado: 'sp' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/UF de 2 letras maiúsculas/);
    }
  });

  it('rejeita telefone curto', () => {
    const result = condominioCreateSchema.safeParse({ ...VALID_PAYLOAD, contato_telefone: '123' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome curto demais', () => {
    const result = condominioCreateSchema.safeParse({ ...VALID_PAYLOAD, nome: 'X' });
    expect(result.success).toBe(false);
  });

  it('rejeita email inválido (quando preenchido)', () => {
    const result = condominioCreateSchema.safeParse({
      ...VALID_PAYLOAD,
      contato_email: 'nao-e-email',
    });
    expect(result.success).toBe(false);
  });
});

describe('condominioUpdateSchema', () => {
  it('aceita payload parcial', () => {
    const result = condominioUpdateSchema.parse({ nome: 'Novo nome' });
    expect(result.nome).toBe('Novo nome');
    expect(result.endereco).toBeUndefined();
  });
});

describe('condominioListQuerySchema', () => {
  it('aplica defaults (page=1, pageSize=20, arquivados=false)', () => {
    const result = condominioListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.include_arquivados).toBe(false);
  });

  it('coerce string → number e parse boolean', () => {
    const result = condominioListQuerySchema.parse({
      page: '3',
      pageSize: '50',
      q: 'aurora',
      include_arquivados: 'true',
    });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.q).toBe('aurora');
    expect(result.include_arquivados).toBe(true);
  });

  it('rejeita pageSize > 100', () => {
    const result = condominioListQuerySchema.safeParse({ pageSize: '500' });
    expect(result.success).toBe(false);
  });
});
