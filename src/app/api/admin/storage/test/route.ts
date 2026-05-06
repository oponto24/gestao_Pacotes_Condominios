import { NextResponse } from 'next/server';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError, UnauthorizedError } from '@/server/errors';
import { storage } from '@/lib/storage';
import { loggerForRequest } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Smoke endpoint do storage abstraction. Apenas super_admin.
 * Faz put → get → delete de um arquivo descartável e retorna metadata.
 * Não existe em produção (remover/proteger na story 8.4).
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/storage/test' });
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new UnauthorizedError('Apenas super_admin pode rodar storage smoke');
    }

    const ts = Date.now();
    const key = `_smoke/test-${ts}.txt`;
    const body = Buffer.from(`smoke ${ts}\n`, 'utf-8');

    const put = await storage.put({ key, body, contentType: 'text/plain' });
    const exists = await storage.exists(key);
    const got = await storage.get(key);
    await storage.delete(key);
    const existsAfter = await storage.exists(key);

    log.info({ key, size: put.size }, 'storage smoke ok');

    return NextResponse.json({
      ok: true,
      driver: put.driver,
      key,
      size: put.size,
      url: put.url,
      roundtrip_match: got.body.toString('utf-8') === body.toString('utf-8'),
      exists_before: exists,
      exists_after_delete: existsAfter,
    });
  } catch (err) {
    if (isTenantError(err)) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    log.error({ err }, 'storage smoke falhou');
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
