/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock antes do import
const enqueueMock = vi.fn().mockResolvedValue({ id: 'job-1', name: 'sendWhatsApp', queue: 'default' });
vi.mock('@/lib/queue/queues', () => ({
  enqueue: enqueueMock,
  defaultQueue: {},
  DEFAULT_QUEUE_NAME: 'default',
}));

beforeEach(() => {
  enqueueMock.mockClear();
});

describe('enqueueSendWhatsApp — retry config', () => {
  it('config padrão: jobId determinístico, 4 attempts, backoff exponencial 5s', async () => {
    const { enqueueSendWhatsApp } = await import('@/lib/queue/enqueue-send-whatsapp');
    await enqueueSendWhatsApp({ pacote_id: 'p1', condominio_id: 'c1' });

    expect(enqueueMock).toHaveBeenCalledWith(
      'sendWhatsApp',
      { pacote_id: 'p1', condominio_id: 'c1' },
      expect.objectContaining({
        attempts: 4,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnFail: false,
        jobId: 'sendWhatsApp-p1',
      }),
    );
  });

  it('forceUnique=true: jobId inclui timestamp (não deduplica)', async () => {
    const { enqueueSendWhatsApp } = await import('@/lib/queue/enqueue-send-whatsapp');
    await enqueueSendWhatsApp({ pacote_id: 'p1', condominio_id: 'c1' }, { forceUnique: true });

    const call = enqueueMock.mock.calls[0];
    expect(call?.[2]?.jobId).toMatch(/^sendWhatsApp-p1-\d+$/);
  });

  it('forceUnique=false (default) preserva jobId determinístico', async () => {
    const { enqueueSendWhatsApp } = await import('@/lib/queue/enqueue-send-whatsapp');
    await enqueueSendWhatsApp({ pacote_id: 'p1', condominio_id: 'c1' });
    await enqueueSendWhatsApp({ pacote_id: 'p1', condominio_id: 'c1' });

    expect(enqueueMock.mock.calls[0]?.[2]?.jobId).toBe('sendWhatsApp-p1');
    expect(enqueueMock.mock.calls[1]?.[2]?.jobId).toBe('sendWhatsApp-p1');
  });
});
