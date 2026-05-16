/**
 * Smoke do entry provider-agnóstico (lib/ai/extract-label.ts).
 * Garante que mexer no provider via env funciona end-to-end.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/test-extract-via-entry.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractLabelFromImage } from '../../src/lib/ai/extract-label';

async function main() {
  const file = process.argv[2] ?? 'scripts/dev/fixtures/etiquetas/pacote_teste.jpeg';
  const filePath = path.resolve(__dirname, '../..', file);
  const buffer = await readFile(filePath);

  console.log(`Foto: ${file} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log(`Provider: ${process.env.EXTRACT_LABEL_PROVIDER ?? 'gemini (default)'}`);
  console.log(`Fallback: ${process.env.EXTRACT_LABEL_FALLBACK ?? 'anthropic (default)'}`);

  const result = await extractLabelFromImage({ buffer, mimeType: 'image/jpeg' });

  console.log(`\nProvider usado: ${result.provider}`);
  console.log(`Modelo: ${result.model}`);
  console.log(`Duração: ${result.durationMs}ms`);
  console.log(`Tokens: in=${result.usage.input_tokens} out=${result.usage.output_tokens}`);
  console.log(`Confiança: ${result.confianca}`);
  console.log(`JSON:`);
  console.log(JSON.stringify(result.json, null, 2));
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
