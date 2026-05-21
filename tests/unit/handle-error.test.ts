/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, ZodIssue } from 'zod';

// We test handleApiError by importing it with different NODE_ENV values

describe('handleApiError', () => {
  const mockLog = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    child: vi.fn(),
  };

  function makeZodError(fields: { path: string[]; message: string }[]): ZodError {
    const issues: ZodIssue[] = fields.map((f) => ({
      path: f.path,
      message: f.message,
      code: 'custom',
    }));
    return new ZodError(issues);
  }

  it('should NOT return fields in production for ZodError', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Re-import to get fresh module with production env
    vi.resetModules();
    const { handleApiError } = await import('@/lib/api/handle-error');

    const err = makeZodError([{ path: ['email'], message: 'required' }]);
    const response = handleApiError(err, mockLog as any);
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.code).toBe('validation_error');
    expect(body.fields).toBeUndefined();

    process.env.NODE_ENV = origEnv;
  });

  it('should return fields in development for ZodError', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    vi.resetModules();
    const { handleApiError } = await import('@/lib/api/handle-error');

    const err = makeZodError([{ path: ['email'], message: 'required' }]);
    const response = handleApiError(err, mockLog as any);
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.code).toBe('validation_error');
    expect(body.fields).toBeDefined();
    expect(body.fields.email).toContain('required');

    process.env.NODE_ENV = origEnv;
  });
});
