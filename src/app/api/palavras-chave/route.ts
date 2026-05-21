import { NextResponse } from 'next/server';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { loggerForRequest } from '@/lib/logger';
import { listPalavrasChavePendentes } from '@/lib/db/palavra-chave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'palavras-chave:list' });
  try {
    const ctx = await requirePorteiro();
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() || undefined;
    const palavras = await listPalavrasChavePendentes(ctx, { q });
    return NextResponse.json(palavras);
  } catch (err) {
    return handleApiError(err, log);
  }
}
