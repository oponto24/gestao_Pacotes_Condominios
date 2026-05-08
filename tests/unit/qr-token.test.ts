/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { generateQrToken } from '@/lib/qr/token';

describe('generateQrToken', () => {
  it('retorna string com 64 chars', () => {
    const token = generateQrToken();
    expect(token).toHaveLength(64);
  });

  it('é URL-safe (apenas chars base64url)', () => {
    for (let i = 0; i < 50; i++) {
      const token = generateQrToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain('/');
      expect(token).not.toContain('+');
      expect(token).not.toContain('=');
    }
  });

  it('gera tokens únicos em chamadas consecutivas', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(generateQrToken());
    }
    expect(seen.size).toBe(100);
  });
});
