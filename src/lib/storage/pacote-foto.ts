import { createHash } from 'node:crypto';
import { storage } from '@/lib/storage';

/**
 * Helper para salvar foto de etiqueta de pacote no storage (story 3.4).
 *
 * Path determinístico: `pacotes/{condominio_id}/{pacote_id}/original.{ext}`
 * (prefixo `pacotes/` permite cleanup e organização futura).
 *
 * Calcula hash SHA-256 do conteúdo para audit forense (NFR-033).
 */

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export interface SavePacoteFotoInput {
  condominioId: string;
  pacoteId: string;
  buffer: Buffer;
  mimeType: string;
}

export interface SavePacoteFotoResult {
  storagePath: string;
  bytes: number;
  hashSha256: string;
  mimeType: string;
}

/**
 * Salva o buffer da foto no storage e retorna metadados para insert no DB.
 *
 * Lança erro se mime não suportado. Caller decide se faz cleanup do arquivo
 * em caso de falha posterior do DB (storage não é transacional).
 */
export async function savePacoteFoto(
  input: SavePacoteFotoInput,
): Promise<SavePacoteFotoResult> {
  if (!SUPPORTED_MIMES.has(input.mimeType)) {
    throw new Error(`Mime type não suportado: ${input.mimeType}`);
  }
  if (input.buffer.length === 0) {
    throw new Error('Buffer da foto está vazio');
  }

  const ext = EXT_BY_MIME[input.mimeType];
  const storagePath = `pacotes/${input.condominioId}/${input.pacoteId}/original.${ext}`;

  const hashSha256 = createHash('sha256').update(input.buffer).digest('hex');

  await storage.put({
    key: storagePath,
    body: input.buffer,
    contentType: input.mimeType,
  });

  return {
    storagePath,
    bytes: input.buffer.length,
    hashSha256,
    mimeType: input.mimeType,
  };
}

/**
 * Limpa foto do storage — usar quando DB falha após `savePacoteFoto` (cleanup
 * best-effort). Não lança se já foi removida.
 */
export async function deletePacoteFoto(storagePath: string): Promise<void> {
  try {
    await storage.delete(storagePath);
  } catch {
    // ignora — arquivo pode já não existir
  }
}
