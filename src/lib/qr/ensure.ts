import { withSuperAdmin } from '@/lib/db-super-admin';
import { generateQrImage } from './generator';
import { saveQrImage } from './store';

export interface EnsureQrResult {
  qrToken: string;
  publicUrl: string;
  /** True se a imagem foi gerada nesta chamada; false se já existia. */
  generated: boolean;
}

/**
 * Garante que o pacote tenha QR Code gerado e persistido.
 *
 * Idempotente: se `qr_image_path` já está preenchido, retorna URL existente
 * sem regenerar. Senão gera, salva no storage e atualiza o registro.
 *
 * **Bypassa RLS** — usa client global do Prisma. Caller (worker BullMQ) é
 * responsável pelo isolamento. Routes que invoquem isso devem aplicar
 * tenant context separadamente.
 */
export async function ensureQrForPacote(pacoteId: string): Promise<EnsureQrResult> {
  const pacote = await withSuperAdmin((tx) =>
    tx.pacote.findUnique({
      where: { id: pacoteId },
      select: {
        id: true,
        condominio_id: true,
        qr_token: true,
        qr_image_path: true,
        condominio: { select: { nome: true } },
      },
    }),
  );
  if (!pacote) {
    throw new Error(`Pacote ${pacoteId} não encontrado`);
  }

  if (pacote.qr_image_path) {
    const { storage } = await import('@/lib/storage');
    return {
      qrToken: pacote.qr_token,
      publicUrl: storage.publicUrl(pacote.qr_image_path),
      generated: false,
    };
  }

  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const qrPayloadUrl = `${appUrl}/retirada/confirmar/${pacote.qr_token}`;

  const { buffer } = await generateQrImage({
    qrPayloadUrl,
    condominioNome: pacote.condominio.nome,
  });

  const saved = await saveQrImage(pacote.condominio_id, pacote.id, buffer);

  await withSuperAdmin((tx) =>
    tx.pacote.update({
      where: { id: pacote.id },
      data: { qr_image_path: saved.storageKey },
    }),
  );

  return {
    qrToken: pacote.qr_token,
    publicUrl: saved.publicUrl,
    generated: true,
  };
}
