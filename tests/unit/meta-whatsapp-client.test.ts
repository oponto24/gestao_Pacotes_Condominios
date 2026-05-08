/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMetaClientForTests,
  __testing__,
  getMetaClient,
  sendTemplate,
} from '@/lib/meta-whatsapp/client';
import { MetaApiError } from '@/lib/meta-whatsapp/errors';

const ORIGINAL_ENV = { ...process.env };

function setEnv(envs: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(envs)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  __resetMetaClientForTests();
  setEnv({
    META_ACCESS_TOKEN: 'fake-token',
    META_PHONE_NUMBER_ID: '12345',
    META_API_VERSION: 'v25.0',
    META_DISABLED: undefined,
  });
});

afterEach(() => {
  __resetMetaClientForTests();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('buildSendTemplatePayload', () => {
  it('inclui header image quando headerImageUrl é informado', () => {
    const payload = __testing__.buildSendTemplatePayload({
      to: '5511999999999',
      templateName: 'pacote_chegou',
      languageCode: 'pt_BR',
      headerImageUrl: 'https://example.com/qr.png',
      bodyParams: ['João', 'Edifício Central'],
    });
    expect(payload.template.components).toHaveLength(2);
    expect(payload.template.components?.[0]).toEqual({
      type: 'header',
      parameters: [{ type: 'image', image: { link: 'https://example.com/qr.png' } }],
    });
    expect(payload.template.components?.[1]).toEqual({
      type: 'body',
      parameters: [
        { type: 'text', text: 'João' },
        { type: 'text', text: 'Edifício Central' },
      ],
    });
  });

  it('omite header quando headerImageUrl ausente', () => {
    const payload = __testing__.buildSendTemplatePayload({
      to: '5511999999999',
      templateName: 'hello_world',
      languageCode: 'en_US',
      bodyParams: [],
    });
    expect(payload.template.components).toBeUndefined();
  });
});

describe('normalizePhone', () => {
  it.each([
    ['+5511999999999', '5511999999999'],
    ['55 11 99999-9999', '5511999999999'],
    ['(11) 99999-9999', '11999999999'],
    ['5511999999999', '5511999999999'],
  ])('normaliza "%s" para "%s"', (input, expected) => {
    expect(__testing__.normalizePhone(input)).toBe(expected);
  });
});

describe('sendTemplate — modo mock (META_DISABLED=true)', () => {
  it('retorna wamid simulado e mock=true', async () => {
    setEnv({ META_DISABLED: 'true', META_ACCESS_TOKEN: undefined, META_PHONE_NUMBER_ID: undefined });
    __resetMetaClientForTests();

    const result = await sendTemplate({
      to: '5511999999999',
      templateName: 'pacote_chegou',
      languageCode: 'pt_BR',
      bodyParams: ['João', 'Edifício Central'],
    });

    expect(result.mock).toBe(true);
    expect(result.wamid).toMatch(/^mock-/);
    expect(getMetaClient().isMock()).toBe(true);
  });
});

describe('sendTemplate — chamadas reais (fetch mockado)', () => {
  it('sucesso: retorna wamid da resposta Meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messaging_product: 'whatsapp',
          contacts: [{ input: '5511999999999', wa_id: '5511999999999' }],
          messages: [{ id: 'wamid.HBgM' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTemplate({
      to: '5511999999999',
      templateName: 'pacote_chegou',
      languageCode: 'pt_BR',
      bodyParams: ['João', 'Edifício'],
    });

    expect(result.wamid).toBe('wamid.HBgM');
    expect(result.mock).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v25.0/12345/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-token',
      'Content-Type': 'application/json',
    });
  });

  it('erro 401 lança MetaApiError com retriable=false (code 100)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'Invalid OAuth access token',
            code: 100,
            fbtrace_id: 'AAA',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = sendTemplate({
      to: '5511999999999',
      templateName: 'x',
      languageCode: 'pt_BR',
    });

    await expect(promise).rejects.toBeInstanceOf(MetaApiError);
    await promise.catch((err: MetaApiError) => {
      expect(err.code).toBe(100);
      expect(err.retriable).toBe(false);
      expect(err.httpStatus).toBe(401);
      expect(err.fbtrace_id).toBe('AAA');
    });
  });

  it('erro 429 (code 131056) lança MetaApiError retriable=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Rate limit', code: 131056 },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendTemplate({ to: '5511999999999', templateName: 'x', languageCode: 'pt_BR' }),
    ).rejects.toMatchObject({ code: 131056, retriable: true });
  });

  it('erro 5xx lança MetaApiError retriable=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendTemplate({ to: '5511999999999', templateName: 'x', languageCode: 'pt_BR' }),
    ).rejects.toMatchObject({ retriable: true });
  });

  it('network error lança MetaApiError retriable=true', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendTemplate({ to: '5511999999999', templateName: 'x', languageCode: 'pt_BR' }),
    ).rejects.toMatchObject({ retriable: true, code: 0 });
  });
});

describe('sendTemplate — config faltando', () => {
  it('lança erro quando META_ACCESS_TOKEN ausente e META_DISABLED não setado', () => {
    setEnv({ META_ACCESS_TOKEN: undefined });
    __resetMetaClientForTests();
    expect(() => getMetaClient()).toThrowError(/META_ACCESS_TOKEN/);
  });

  it('lança erro quando META_PHONE_NUMBER_ID ausente', () => {
    setEnv({ META_PHONE_NUMBER_ID: undefined });
    __resetMetaClientForTests();
    expect(() => getMetaClient()).toThrowError(/META_PHONE_NUMBER_ID/);
  });
});
