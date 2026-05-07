import { describe, it, expect } from 'vitest';
import { extractQrToken, isValidQrToken } from '@/lib/retirada/extract-qr-token';

describe('extractQrToken', () => {
  it('aceita token puro válido', () => {
    expect(extractQrToken('abc123def456ghi789ghi789')).toBe('abc123def456ghi789ghi789');
  });

  it('aceita token base64url 64 chars', () => {
    const t = 'A'.repeat(40) + 'B-_d_'.repeat(4);
    expect(extractQrToken(t)).toBe(t);
  });

  it('aceita URL absoluta', () => {
    expect(
      extractQrToken('https://condominios.oponto24.com.br/retirada/confirmar/abc123def456ghi789'),
    ).toBe('abc123def456ghi789');
  });

  it('aceita URL relativa', () => {
    expect(extractQrToken('/retirada/confirmar/xyz789xyz789xyz789')).toBe('xyz789xyz789xyz789');
  });

  it('aceita URL com query/hash', () => {
    expect(
      extractQrToken('https://app/retirada/confirmar/abc123def456ghi789?source=qr'),
    ).toBe('abc123def456ghi789');
  });

  it('rejeita token curto (<16)', () => {
    expect(extractQrToken('abc123')).toBeNull();
  });

  it('rejeita token longo (>64)', () => {
    expect(extractQrToken('A'.repeat(65))).toBeNull();
  });

  it('rejeita lixo aleatório', () => {
    expect(extractQrToken('hello world')).toBeNull();
    expect(extractQrToken('!@#$%')).toBeNull();
  });

  it('null/empty', () => {
    expect(extractQrToken(null)).toBeNull();
    expect(extractQrToken('')).toBeNull();
    expect(extractQrToken('   ')).toBeNull();
    expect(extractQrToken(undefined)).toBeNull();
  });

  it('trim de whitespace', () => {
    expect(extractQrToken('  abc123def456ghi789ghi789  ')).toBe('abc123def456ghi789ghi789');
  });
});

describe('isValidQrToken', () => {
  it('valida formato', () => {
    expect(isValidQrToken('abc123def456ghi789ghi789')).toBe(true);
    expect(isValidQrToken('short')).toBe(false);
  });
});
