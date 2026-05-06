/* @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { LocalStorageDriver } from '@/lib/storage/local';

describe('LocalStorageDriver', () => {
  const root = path.join(tmpdir(), `storage-test-${Date.now()}`);
  const driver = new LocalStorageDriver({ rootDir: root });

  beforeAll(async () => {
    await fs.mkdir(root, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('put → get → delete roundtrip', async () => {
    const key = 'fotos-pacotes/cond-1/p1.txt';
    const body = Buffer.from('hello storage', 'utf-8');

    const put = await driver.put({ key, body, contentType: 'text/plain' });
    expect(put.key).toBe(key);
    expect(put.size).toBe(body.length);
    expect(put.driver).toBe('local');

    expect(await driver.exists(key)).toBe(true);

    const got = await driver.get(key);
    expect(got.body.toString('utf-8')).toBe('hello storage');

    await driver.delete(key);
    expect(await driver.exists(key)).toBe(false);
  });

  it('rejeita path traversal com ..', async () => {
    await expect(
      driver.put({ key: '../../escape.txt', body: Buffer.from('x') }),
    ).rejects.toThrow(/inválida/);
  });

  it('rejeita key absoluta', async () => {
    await expect(
      driver.put({ key: '/abs/path.txt', body: Buffer.from('x') }),
    ).rejects.toThrow(/inválida/);
  });

  it('rejeita caracteres proibidos', async () => {
    await expect(
      driver.put({ key: 'foo bar.txt', body: Buffer.from('x') }),
    ).rejects.toThrow(/inválida/);
  });

  it('delete em chave inexistente é idempotente', async () => {
    await expect(driver.delete('nao/existe.txt')).resolves.toBeUndefined();
  });

  it('publicUrl retorna path lógico determinístico', () => {
    expect(driver.publicUrl('a/b/c.txt')).toBe('/api/storage/local/a/b/c.txt');
  });
});
