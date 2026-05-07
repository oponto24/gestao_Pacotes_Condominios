// Contrato genérico de storage. Hoje só `local`; story 8.x pode adicionar S3/R2
// mantendo a mesma interface.

export type StorageDriverName = 'local';

export interface PutObjectInput {
  /** Chave lógica (ex: "fotos-pacotes/<condominio_id>/<pacote_id>.jpg"). */
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
}

export interface PutObjectResult {
  key: string;
  size: number;
  url: string;
  driver: StorageDriverName;
}

export interface GetObjectResult {
  key: string;
  body: Buffer;
  size: number;
  contentType?: string;
}

export interface StorageDriver {
  readonly name: StorageDriverName;
  put(input: PutObjectInput): Promise<PutObjectResult>;
  get(key: string): Promise<GetObjectResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** URL pra download local (dev: file:// ou /api/storage/local/<key>). */
  publicUrl(key: string): string;
}
