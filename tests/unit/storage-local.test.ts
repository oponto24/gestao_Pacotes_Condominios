/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalStorageDriver } from '@/lib/storage/local';

describe('LocalStorageDriver.publicUrl', () => {
  const originalEnv = process.env.APP_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.APP_URL = originalEnv;
    } else {
      delete process.env.APP_URL;
    }
  });

  it('gera URL absoluta com APP_URL', () => {
    process.env.APP_URL = 'https://condominios.oponto24.com.br';
    const driver = new LocalStorageDriver({ rootDir: '/tmp/storage' });
    expect(driver.publicUrl('qr/abc.png')).toBe(
      'https://condominios.oponto24.com.br/api/storage/local/qr/abc.png',
    );
  });

  it('remove trailing slash do APP_URL', () => {
    process.env.APP_URL = 'https://example.com/';
    const driver = new LocalStorageDriver({ rootDir: '/tmp/storage' });
    expect(driver.publicUrl('test.png')).toBe(
      'https://example.com/api/storage/local/test.png',
    );
  });

  it('fallback para localhost quando APP_URL não definido', () => {
    delete process.env.APP_URL;
    const driver = new LocalStorageDriver({ rootDir: '/tmp/storage' });
    expect(driver.publicUrl('qr/test.png')).toBe(
      'http://localhost:3000/api/storage/local/qr/test.png',
    );
  });

  it('rejeita key com path traversal', () => {
    const driver = new LocalStorageDriver({ rootDir: '/tmp/storage' });
    expect(() => driver.publicUrl('../etc/passwd')).toThrow(/inválida/);
  });

  it('rejeita key vazia', () => {
    const driver = new LocalStorageDriver({ rootDir: '/tmp/storage' });
    expect(() => driver.publicUrl('')).toThrow(/inválida/);
  });
});
