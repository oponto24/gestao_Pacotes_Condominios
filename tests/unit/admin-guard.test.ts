/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '@/server/errors';

const getTenantContextMock = vi.fn();
vi.mock('@/server/middleware/tenant', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const tenantCtx = (role: string) => ({
  kind: 'tenant' as const,
  userId: 'u-1',
  condominioId: 'c-1',
  role,
});

beforeEach(() => {
  getTenantContextMock.mockReset();
});

describe('requireAdminMaster', () => {
  it('aceita admin_master', async () => {
    getTenantContextMock.mockResolvedValue(tenantCtx('admin_master'));
    const { requireAdminMaster } = await import('@/lib/api/admin-guard');
    const result = await requireAdminMaster();
    expect(result.role).toBe('admin_master');
    expect(result.userId).toBe('u-1');
  });

  it.each(['admin_funcionario', 'porteiro', 'super_admin'])('rejeita %s', async (role) => {
    getTenantContextMock.mockResolvedValue(tenantCtx(role));
    const { requireAdminMaster } = await import('@/lib/api/admin-guard');
    await expect(requireAdminMaster()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejeita super_admin (kind super_admin)', async () => {
    getTenantContextMock.mockResolvedValue({ kind: 'super_admin', userId: 'u-1' });
    const { requireAdminMaster } = await import('@/lib/api/admin-guard');
    await expect(requireAdminMaster()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('requireAdminFuncionario', () => {
  it('aceita admin_funcionario', async () => {
    getTenantContextMock.mockResolvedValue(tenantCtx('admin_funcionario'));
    const { requireAdminFuncionario } = await import('@/lib/api/admin-guard');
    const result = await requireAdminFuncionario();
    expect(result.role).toBe('admin_funcionario');
  });

  it.each(['admin_master', 'porteiro'])('rejeita %s', async (role) => {
    getTenantContextMock.mockResolvedValue(tenantCtx(role));
    const { requireAdminFuncionario } = await import('@/lib/api/admin-guard');
    await expect(requireAdminFuncionario()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('requireAdminAny', () => {
  it.each(['admin_master', 'admin_funcionario'])('aceita %s', async (role) => {
    getTenantContextMock.mockResolvedValue(tenantCtx(role));
    const { requireAdminAny } = await import('@/lib/api/admin-guard');
    const result = await requireAdminAny();
    expect(result.role).toBe(role);
  });

  it.each(['porteiro'])('rejeita %s', async (role) => {
    getTenantContextMock.mockResolvedValue(tenantCtx(role));
    const { requireAdminAny } = await import('@/lib/api/admin-guard');
    await expect(requireAdminAny()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('requireAdminOrPorteiro', () => {
  it.each(['admin_master', 'admin_funcionario', 'porteiro'])('aceita %s', async (role) => {
    getTenantContextMock.mockResolvedValue(tenantCtx(role));
    const { requireAdminOrPorteiro } = await import('@/lib/api/admin-guard');
    const result = await requireAdminOrPorteiro();
    expect(result.role).toBe(role);
  });

  it('rejeita super_admin', async () => {
    getTenantContextMock.mockResolvedValue({ kind: 'super_admin', userId: 'u-1' });
    const { requireAdminOrPorteiro } = await import('@/lib/api/admin-guard');
    await expect(requireAdminOrPorteiro()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// Alias deprecated `requireAdmin` removido em 10.1b após cleanup dos 15 callers.
// Histórico do refactor permanece no story file.
