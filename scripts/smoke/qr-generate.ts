/**
 * Smoke test manual — gera 1 QR e abre no Preview (macOS) pra revisão visual.
 *
 * Uso:
 *   npx tsx scripts/smoke/qr-generate.ts
 *   npx tsx scripts/smoke/qr-generate.ts --condo="Edifício Solar" --url="https://example.com/x"
 */
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { generateQrImage } from '@/lib/qr/generator';

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main(): Promise<void> {
  const condominioNome = arg('condo', 'Edifício Central');
  const qrPayloadUrl = arg(
    'url',
    'https://condominios.oponto24.com.br/retirada/confirmar/SmokeTokenAbCdEf1234567890123456789012345678901234567890',
  );

  const out = join(tmpdir(), `qr-smoke-${Date.now()}.png`);
  const { buffer } = await generateQrImage({ qrPayloadUrl, condominioNome });
  await writeFile(out, buffer);

  // eslint-disable-next-line no-console
  console.log(`[smoke:qr] Salvo em ${out} (${buffer.length} bytes)`);

  if (process.platform === 'darwin') {
    spawn('open', [out], { stdio: 'ignore', detached: true }).unref();
  } else {
    // eslint-disable-next-line no-console
    console.log('[smoke:qr] Abra manualmente:', out);
  }
}

void main();
