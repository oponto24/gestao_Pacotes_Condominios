/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getCurrentUser
const getCurrentUserMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

// Mock cookies (next/headers)
const cookieGetMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: cookieGetMock }),
}));

// Mock db
const findFirstMock = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    condominio: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
  },
}));

// Mock react cache (identity function)
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

beforeEach(() => {
  vi.resetModules();
  getCurrentUserMock.mockReset();
  cookieGetMock.mockReset();
  findFirstMock.mockReset();
});

describe('getTenantContext — condominio suspended check', () => {
  it('throws CondominioSuspendedError when condominio.ativo=false', async () => {
    getCurrentUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: { id: 'u-1', role: 'admin_master', condominio_id: 'c-1' },
    });
    findFirstMock.mockResolvedValue({ ativo: false });

    const { getTenantContext } = await import('@/server/middleware/tenant');
    await expect(getTenantContext()).rejects.toThrow('temporariamente suspenso');
  });

  it('throws CondominioSuspendedError when condominio not found (deleted)', async () => {
    getCurrentUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: { id: 'u-1', role: 'porteiro', condominio_id: 'c-deleted' },
    });
    findFirstMock.mockResolvedValue(null);

    const { getTenantContext } = await import('@/server/middleware/tenant');
    await expect(getTenantContext()).rejects.toThrow('temporariamente suspenso');
  });

  it('returns tenant context when condominio.ativo=true', async () => {
    getCurrentUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: { id: 'u-1', role: 'admin_master', condominio_id: 'c-1' },
    });
    findFirstMock.mockResolvedValue({ ativo: true });

    const { getTenantContext } = await import('@/server/middleware/tenant');
    const ctx = await getTenantContext();
    expect(ctx).toEqual({
      kind: 'tenant',
      userId: 'u-1',
      condominioId: 'c-1',
      role: 'admin_master',
    });
  });

  it('throws NoCondominioAssignedError when user has no condominio_id', async () => {
    getCurrentUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: { id: 'u-1', role: 'porteiro', condominio_id: null },
    });

    const { getTenantContext } = await import('@/server/middleware/tenant');
    await expect(getTenantContext()).rejects.toThrow('não está associado');
  });
});
