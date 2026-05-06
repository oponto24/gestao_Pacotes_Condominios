import path from 'node:path';
import { LocalStorageDriver } from './local';
import type { StorageDriver, StorageDriverName } from './types';

export type { StorageDriver, StorageDriverName, PutObjectInput, PutObjectResult, GetObjectResult } from './types';

const globalForStorage = globalThis as unknown as { storage?: StorageDriver };

function buildStorage(): StorageDriver {
  const driverName = (process.env.STORAGE_DRIVER ?? 'local') as StorageDriverName;
  switch (driverName) {
    case 'local': {
      const rootDir = process.env.STORAGE_LOCAL_ROOT ?? path.resolve(process.cwd(), 'storage');
      return new LocalStorageDriver({ rootDir });
    }
    default:
      throw new Error(`STORAGE_DRIVER desconhecido: ${driverName}`);
  }
}

export const storage: StorageDriver = globalForStorage.storage ?? buildStorage();
if (process.env.NODE_ENV !== 'production') globalForStorage.storage = storage;
