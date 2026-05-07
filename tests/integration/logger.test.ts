/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { logger, loggerForRequest, loggerForJob, loggerForTenant } from '@/lib/logger';

describe('logger (Pino)', () => {
  it('expõe singleton com nível configurável', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('loggerForRequest usa header x-request-id quando presente', () => {
    const headers = new Headers({ 'x-request-id': 'req-abc-123' });
    const child = loggerForRequest({ headers });
    expect(child).toBeDefined();
    // Pino expõe bindings() com os campos do child
    const bindings = (child as unknown as { bindings: () => Record<string, unknown> }).bindings();
    expect(bindings.request_id).toBe('req-abc-123');
  });

  it('loggerForRequest gera request_id quando ausente', () => {
    const child = loggerForRequest({ headers: new Headers() });
    const bindings = (child as unknown as { bindings: () => Record<string, unknown> }).bindings();
    expect(typeof bindings.request_id).toBe('string');
    expect((bindings.request_id as string).length).toBeGreaterThan(0);
  });

  it('loggerForJob inclui job_id e job_name', () => {
    const child = loggerForJob({ id: 'job-42', name: 'ping' });
    const bindings = (child as unknown as { bindings: () => Record<string, unknown> }).bindings();
    expect(bindings.job_id).toBe('job-42');
    expect(bindings.job_name).toBe('ping');
  });

  it('loggerForTenant inclui condominio_id quando autenticado', () => {
    const child = loggerForTenant({
      kind: 'authenticated',
      userId: 'usr_1',
      condominioId: '11111111-1111-1111-1111-111111111111',
      role: 'porteiro',
      user: {} as never,
    } as never);
    const bindings = (child as unknown as { bindings: () => Record<string, unknown> }).bindings();
    expect(bindings.condominio_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(bindings.role).toBe('porteiro');
    expect(bindings.user_id).toBe('usr_1');
  });
});
