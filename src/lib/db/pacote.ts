import { randomBytes } from 'node:crypto';
import { withTenant } from '@/server/db-tenant';
import type { TenantTx } from '@/server/db-tenant';

/**
 * Gera token random URL-safe de 64 chars para assinar o QR Code do pacote.
 * Usado pela story 4.x (geração de QR + Meta Cloud API).
 */
function generateQrToken(): string {
  // 32 bytes → ~43 chars base64url. Pad até 64 para preencher VarChar(64).
  return randomBytes(48).toString('base64url').slice(0, 64);
}

/**
 * DB helpers de Pacote (story 3.4 — primeira de muitas).
 */

export interface CreatePacoteRascunhoInput {
  /** condominio_id do tenant context. */
  condominioId: string;
  /** user_id do porteiro/admin que está criando. */
  userId: string;
  /** Código de rastreio (opcional, do bipe ou digitação). */
  codigoRastreio?: string | undefined;
  /** Foto principal (já salva no storage — caller passa metadados). */
  foto: {
    storagePath: string;
    mimeType: string;
    bytes: number;
    hashSha256: string;
  };
}

export interface CreatePacoteRascunhoResult {
  pacoteId: string;
  fotoId: string;
}

/**
 * Cria pacote em estado `rascunho` em uma única transação RLS-aware:
 *   1. `pacote.create` (status='rascunho', codigo_rastreio?)
 *   2. `pacote_foto.create` (vinculada ao pacote, is_principal=true)
 *   3. `pacote_evento.create` (tipo='criado', user_id=ctx.userId)
 *
 * Qualquer erro → rollback completo (foto no storage fica órfã — cleanup
 * best-effort no caller via `deletePacoteFoto` se quiser tentar limpar).
 */
export function createPacoteRascunho(
  input: CreatePacoteRascunhoInput,
): Promise<CreatePacoteRascunhoResult> {
  return withTenant(async (tx) => {
    return createPacoteRascunhoWithTx(tx, input);
  });
}

/**
 * Versão exposta para tests integration que setam contexto manualmente.
 */
export async function createPacoteRascunhoWithTx(
  tx: TenantTx,
  input: CreatePacoteRascunhoInput,
): Promise<CreatePacoteRascunhoResult> {
  const pacote = await tx.pacote.create({
    data: {
      condominio_id: input.condominioId,
      codigo_rastreio: input.codigoRastreio ?? null,
      status: 'rascunho',
      qr_token: generateQrToken(),
      // FR-019: timestamp servidor automático
      recebido_em: new Date(),
      // FR-020: funcionário capturado via login
      funcionario_recebedor_id: input.userId,
    },
    select: { id: true },
  });

  const foto = await tx.pacoteFoto.create({
    data: {
      condominio_id: input.condominioId,
      pacote_id: pacote.id,
      storage_path: input.foto.storagePath,
      mime_type: input.foto.mimeType,
      bytes: input.foto.bytes,
      hash_sha256: input.foto.hashSha256,
      is_principal: true,
    },
    select: { id: true },
  });

  await tx.pacoteEvento.create({
    data: {
      condominio_id: input.condominioId,
      pacote_id: pacote.id,
      tipo: 'criado',
      user_id: input.userId,
      metadata: {
        foto_storage_path: input.foto.storagePath,
        foto_bytes: input.foto.bytes,
        codigo_rastreio: input.codigoRastreio ?? null,
      },
    },
  });

  return { pacoteId: pacote.id, fotoId: foto.id };
}
