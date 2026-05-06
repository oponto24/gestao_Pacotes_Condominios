import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { loggerForRequest } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ClerkUserPayload = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

type ClerkWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string;
  data: ClerkUserPayload;
};

function pickPrimaryEmail(p: ClerkUserPayload): string | null {
  const emails = p.email_addresses ?? [];
  if (emails.length === 0) return null;
  if (p.primary_email_address_id) {
    const primary = emails.find((e) => e.id === p.primary_email_address_id);
    if (primary) return primary.email_address;
  }
  return emails[0]?.email_address ?? null;
}

function pickName(p: ClerkUserPayload): string {
  const first = p.first_name?.trim() ?? '';
  const last = p.last_name?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (p.username) return p.username;
  return p.email_addresses?.[0]?.email_address ?? p.id;
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'clerk-webhook' });
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret || secret === 'whsec_PENDING_DASHBOARD_CONFIG') {
    log.error('CLERK_WEBHOOK_SECRET não configurada');
    // 200 para não causar retry da Clerk até config estar pronta
    return NextResponse.json({ ok: false, reason: 'webhook_not_configured' }, { status: 200 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, reason: 'missing_svix_headers' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    log.warn({ svix_id: svixId }, 'HMAC inválido');
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const email = pickPrimaryEmail(event.data);
      const nome = pickName(event.data);
      if (!email) {
        log.warn({ clerk_id: event.data.id }, 'user sem email primário');
        return NextResponse.json({ ok: false, reason: 'no_email' }, { status: 200 });
      }

      // Upsert preserva condominio_id e role se já existirem (não sobrescreve com defaults).
      await db.user.upsert({
        where: { clerk_id: event.data.id },
        create: {
          clerk_id: event.data.id,
          email,
          nome,
          role: 'porteiro',
          condominio_id: null,
          ativo: true,
        },
        update: {
          email,
          nome,
          ativo: true,
        },
      });

      log.info({ event_type: event.type, clerk_id: event.data.id, email }, 'evento processado');
    } else if (event.type === 'user.deleted') {
      // NÃO deletar — preserva FKs em pacotes/eventos. Marca inativo.
      await db.user.updateMany({
        where: { clerk_id: event.data.id },
        data: { ativo: false },
      });
      log.info({ clerk_id: event.data.id }, 'user.deleted → ativo=false');
    } else {
      log.info({ event_type: event.type }, 'evento ignorado');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Sempre 200 para Clerk não ficar retentando indefinidamente; logamos para debug.
    log.error({ err }, 'erro interno');
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 200 });
  }
}
