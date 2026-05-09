import { describe, it, expect } from 'vitest';
import {
  userCreateSuperAdminSchema,
  userCreateAdminSchema,
} from '@/lib/validators/user-create';

const UUID = '00000000-0000-4000-8000-000000000000';

describe('userCreateSuperAdminSchema', () => {
  it('aceita payload válido', () => {
    expect(() =>
      userCreateSuperAdminSchema.parse({
        condominio_id: UUID,
        email: 'admin@cond.com',
        nome: 'João Admin',
      }),
    ).not.toThrow();
  });

  it('rejeita email inválido', () => {
    expect(() =>
      userCreateSuperAdminSchema.parse({
        condominio_id: UUID,
        email: 'not-email',
        nome: 'X',
      }),
    ).toThrow();
  });

  it('rejeita cond_id não-UUID', () => {
    expect(() =>
      userCreateSuperAdminSchema.parse({
        condominio_id: 'not-uuid',
        email: 'a@b.com',
        nome: 'X',
      }),
    ).toThrow();
  });

  it('rejeita nome vazio (depois de trim)', () => {
    expect(() =>
      userCreateSuperAdminSchema.parse({
        condominio_id: UUID,
        email: 'a@b.com',
        nome: '   ',
      }),
    ).toThrow();
  });

  it('rejeita nome > 200', () => {
    expect(() =>
      userCreateSuperAdminSchema.parse({
        condominio_id: UUID,
        email: 'a@b.com',
        nome: 'a'.repeat(201),
      }),
    ).toThrow();
  });
});

describe('userCreateAdminSchema', () => {
  it('aceita admin', () => {
    expect(() =>
      userCreateAdminSchema.parse({ email: 'a@b.com', nome: 'A', role: 'admin_master' }),
    ).not.toThrow();
  });

  it('aceita porteiro', () => {
    expect(() =>
      userCreateAdminSchema.parse({ email: 'a@b.com', nome: 'A', role: 'porteiro' }),
    ).not.toThrow();
  });

  it('rejeita super_admin', () => {
    expect(() =>
      userCreateAdminSchema.parse({ email: 'a@b.com', nome: 'A', role: 'super_admin' }),
    ).toThrow();
  });

  it('rejeita role ausente', () => {
    expect(() =>
      userCreateAdminSchema.parse({ email: 'a@b.com', nome: 'A' }),
    ).toThrow();
  });
});
