import { storage } from '@/lib/storage';

export interface SaveQrImageResult {
  storageKey: string;
  publicUrl: string;
  size: number;
}

/**
 * Persiste a imagem QR de um pacote no storage.
 *
 * Path: `qr/{condominio_id}/{pacote_id}.png`
 *
 * URL pública é resolvida via `storage.publicUrl(key)`. Em dev (local driver)
 * a URL aponta para `/api/storage/local/<key>`. Em produção (driver futuro)
 * será URL assinada com TTL.
 */
export async function saveQrImage(
  condominioId: string,
  pacoteId: string,
  buffer: Buffer,
): Promise<SaveQrImageResult> {
  const storageKey = `qr/${condominioId}/${pacoteId}.png`;
  const result = await storage.put({
    key: storageKey,
    body: buffer,
    contentType: 'image/png',
  });
  return {
    storageKey: result.key,
    publicUrl: storage.publicUrl(result.key),
    size: result.size,
  };
}
