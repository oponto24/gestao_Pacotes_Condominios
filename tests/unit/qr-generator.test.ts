/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { generateQrImage } from '@/lib/qr/generator';

describe('generateQrImage', () => {
  it('gera PNG válido com dimensões 800x800', async () => {
    const { buffer, mimeType } = await generateQrImage({
      qrPayloadUrl: 'https://condominios.oponto24.com.br/retirada/confirmar/abc123def456',
      condominioNome: 'Edifício Central',
    });

    expect(mimeType).toBe('image/png');

    // Magic bytes PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);
    expect(meta.format).toBe('png');
  }, 10_000);

  it('gera buffer com tamanho razoável (<200KB)', async () => {
    const { buffer } = await generateQrImage({
      qrPayloadUrl: 'https://example.com/retirada/confirmar/' + 'a'.repeat(40),
      condominioNome: 'Condomínio Teste',
    });
    expect(buffer.length).toBeLessThan(200_000);
    expect(buffer.length).toBeGreaterThan(1_000);
  }, 10_000);

  it('escapa caracteres especiais XML no nome do condomínio', async () => {
    // Não deve lançar erro nem corromper o PNG
    const { buffer } = await generateQrImage({
      qrPayloadUrl: 'https://example.com/x',
      condominioNome: 'Edifício <Test> & "Co"',
    });
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);
  }, 10_000);
});
