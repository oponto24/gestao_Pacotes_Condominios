import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { verifyMetaSignature, type MetaWebhookPayload } from '@/lib/meta-whatsapp/webhook';
import { enqueue } from '@/lib/queue/queues';
import { PROCESS_WHATSAPP_WEBHOOK_JOB_NAME } from '@/lib/queue/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook Meta WhatsApp Cloud API (story 4.4).
 *
 * GET — verificação inicial Meta (challenge handshake).
 * POST — recebe events (status updates + inbound). Valida HMAC e enfileira
 *        processamento async pra responder em <1s (Meta exige).
 */

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    expectedToken &&
    token === expectedToken &&
    challenge
  ) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request): Promise<Response> {
  const log = loggerForRequest(req).child({ scope: 'webhook:meta-whatsapp' });

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    log.error('META_APP_SECRET ausente — não é possível validar webhook');
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Body bruto necessário pra HMAC — ler antes de parsear
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    log.warn({ err }, 'Falha ao ler body do webhook');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const signatureHeader = req.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
    log.warn(
      { body_size: rawBody.length, has_signature: !!signatureHeader },
      'Webhook Meta com HMAC inválido',
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON inválido' }, { status: 400 });
  }

  // Enfileira cada `value` separadamente — processamento assíncrono
  let enqueued = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue; // só processamos field=messages
      try {
        await enqueue(PROCESS_WHATSAPP_WEBHOOK_JOB_NAME, { value: change.value });
        enqueued++;
      } catch (err) {
        log.error({ err, entry_id: entry.id }, 'Falha ao enfileirar webhook event');
      }
    }
  }

  log.info({ enqueued }, 'Webhook Meta processado');
  return NextResponse.json({ ok: true, enqueued }, { status: 200 });
}
