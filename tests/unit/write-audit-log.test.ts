import { describe, it, expect } from 'vitest';
import { extractIpFromRequest, extractUserAgent } from '@/lib/audit/write-log';

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://test', { headers });
}

describe('extractIpFromRequest', () => {
  it('prefere X-Real-IP', () => {
    expect(extractIpFromRequest(makeReq({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('cai no primeiro X-Forwarded-For se sem X-Real-IP', () => {
    expect(
      extractIpFromRequest(makeReq({ 'x-forwarded-for': '5.6.7.8, 1.1.1.1' })),
    ).toBe('5.6.7.8');
  });

  it('aceita CF-Connecting-IP como fallback', () => {
    expect(
      extractIpFromRequest(makeReq({ 'cf-connecting-ip': '9.8.7.6' })),
    ).toBe('9.8.7.6');
  });

  it('null sem headers', () => {
    expect(extractIpFromRequest(makeReq({}))).toBeNull();
    expect(extractIpFromRequest(null)).toBeNull();
    expect(extractIpFromRequest(undefined)).toBeNull();
  });

  it('trim em X-Forwarded-For', () => {
    expect(
      extractIpFromRequest(makeReq({ 'x-forwarded-for': '   1.1.1.1   ,2.2.2.2' })),
    ).toBe('1.1.1.1');
  });
});

describe('extractUserAgent', () => {
  it('retorna user-agent', () => {
    expect(extractUserAgent(makeReq({ 'user-agent': 'Mozilla/5.0' }))).toBe('Mozilla/5.0');
  });

  it('trunca em 500 chars', () => {
    const long = 'a'.repeat(600);
    expect(extractUserAgent(makeReq({ 'user-agent': long }))?.length).toBe(500);
  });

  it('null sem header', () => {
    expect(extractUserAgent(makeReq({}))).toBeNull();
    expect(extractUserAgent(null)).toBeNull();
  });
});
