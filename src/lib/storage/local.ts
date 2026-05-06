import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from './types';

// Regex defensiva: chave só pode ter [a-zA-Z0-9._/-], sem ".." e sem barra inicial.
// Defesa em profundidade contra path traversal (além do path.relative no resolveSafe).
const KEY_REGEX = /^(?!\/)(?!.*\.\.)[a-zA-Z0-9._/-]+$/;

function assertValidKey(key: string): void {
  if (!key || key.length > 512) {
    throw new Error(`Storage key inválida (vazia ou >512): ${key}`);
  }
  if (!KEY_REGEX.test(key)) {
    throw new Error(`Storage key inválida (caracteres ou .. proibidos): ${key}`);
  }
}

export interface LocalDriverOptions {
  rootDir: string;
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly rootDir: string;

  constructor(opts: LocalDriverOptions) {
    this.rootDir = path.resolve(opts.rootDir);
  }

  private resolveSafe(key: string): string {
    assertValidKey(key);
    const full = path.resolve(this.rootDir, key);
    const rel = path.relative(this.rootDir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Storage key escapou do rootDir: ${key}`);
    }
    return full;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const fullPath = this.resolveSafe(input.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const buf = Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body);
    await fs.writeFile(fullPath, buf);
    return {
      key: input.key,
      size: buf.length,
      url: this.publicUrl(input.key),
      driver: this.name,
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const fullPath = this.resolveSafe(key);
    const body = await fs.readFile(fullPath);
    return { key, body, size: body.length };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveSafe(key);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolveSafe(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    assertValidKey(key);
    // Em dev, expor via endpoint dedicado seria melhor; por enquanto retornamos
    // um path lógico que o caller pode resolver. Story 4.2 vai mudar para signed URL.
    return `/api/storage/local/${key}`;
  }
}
