import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * GET /api/storage/local/{...path}
 *
 * Serves files from local storage. Public route (no auth) — Meta WhatsApp
 * needs to fetch QR code images to send template messages.
 *
 * Only serves known image types to prevent arbitrary file access.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Path obrigatório' }, { status: 400 });
  }

  const key = segments.join('/');

  // Only allow image files
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Tipo não permitido' }, { status: 403 });
  }

  try {
    const result = await storage.get(key);
    return new NextResponse(new Uint8Array(result.body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(result.size),
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }
}
