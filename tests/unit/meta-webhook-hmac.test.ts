/* @vitest-environment node */
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { verifyMetaSignature } from '@/lib/meta-whatsapp/webhook';

const SECRET = 'test_app_secret_xyz';

function sign(body: string, secret = SECRET): string {
  const hex = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hex}`;
}

describe('verifyMetaSignature', () => {
  it('aceita assinatura válida', () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejeita assinatura inválida', () => {
    const body = '{"x":1}';
    expect(verifyMetaSignature(body, 'sha256=deadbeef'.padEnd('sha256='.length + 64, '0'), SECRET)).toBe(false);
  });

  it('rejeita header ausente', () => {
    expect(verifyMetaSignature('{}', null, SECRET)).toBe(false);
  });

  it('rejeita header sem prefixo sha256=', () => {
    expect(verifyMetaSignature('{}', 'md5=abc', SECRET)).toBe(false);
  });

  it('rejeita assinatura com secret errado', () => {
    const body = '{"x":1}';
    expect(verifyMetaSignature(body, sign(body, 'OUTRO_SECRET'), SECRET)).toBe(false);
  });

  it('rejeita assinatura com tamanho diferente', () => {
    expect(verifyMetaSignature('{}', 'sha256=abc', SECRET)).toBe(false);
  });

  it('é resistente a modificação de body', () => {
    const body = '{"messages":[{"id":"wamid.A"}]}';
    const sig = sign(body);
    // Mesma assinatura, body modificado
    const tamperedBody = '{"messages":[{"id":"wamid.B"}]}';
    expect(verifyMetaSignature(tamperedBody, sig, SECRET)).toBe(false);
  });
});
