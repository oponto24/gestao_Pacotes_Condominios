import { NextResponse } from 'next/server';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { loggerForRequest } from '@/lib/logger';
import { parseIdParam } from '@/lib/validators/_shared';
import { marcarPalavraChaveUsada } from '@/lib/db/palavra-chave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'palavras-chave:usar' });
  try {
    const ctx = await requirePorteiro();
    const id = parseIdParam((await params).id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const result = await marcarPalavraChaveUsada(ctx, id);
    log.info({ palavra_chave_id: id }, 'palavra-chave marcada como usada');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}
