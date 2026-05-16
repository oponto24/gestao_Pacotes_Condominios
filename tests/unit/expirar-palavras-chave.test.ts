/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock withSuperAdmin
const mockUpdateMany = vi.fn();
vi.mock('@/lib/db-super-admin', () => ({
  withSuperAdmin: (fn: (tx: unknown) => unknown) =>
    fn({ codigoMlPendente: { updateMany: mockUpdateMany } }),
}));

vi.mock('@/lib/logger', () => ({
  loggerForJob: () => ({ child: () => ({ info: vi.fn(), error: vi.fn() }) }),
}));

import { processExpirarPalavrasChave } from '@/lib/queue/jobs/expirar-palavras-chave';

describe('expirarPalavrasChave job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marca codigos expirados com status=expirado', async () => {
    mockUpdateMany.mockResolvedValue({ count: 5 });

    const result = await processExpirarPalavrasChave({ id: '1', name: 'test' } as never);

    expect(result).toEqual({ expired: 5 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        status: 'pendente',
        expira_em: { lt: expect.any(Date) },
      },
      data: {
        status: 'expirado',
      },
    });
  });

  it('retorna 0 se nenhum codigo expirado', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await processExpirarPalavrasChave({ id: '2', name: 'test' } as never);

    expect(result).toEqual({ expired: 0 });
  });
});
