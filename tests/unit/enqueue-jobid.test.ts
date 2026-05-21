/* @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock the queue module before importing
vi.mock('@/lib/queue/queues', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

describe('enqueueSendWhatsApp jobId format', () => {
  it('jobId não contém ":" (BullMQ rejeita)', async () => {
    const { enqueue } = await import('@/lib/queue/queues');
    const { enqueueSendWhatsApp } = await import('@/lib/queue/enqueue-send-whatsapp');

    await enqueueSendWhatsApp({
      pacote_id: 'test-uuid-123',
      condominio_id: 'condo-1',
    });

    const call = vi.mocked(enqueue).mock.calls[0];
    const options = call?.[2] as { jobId?: string } | undefined;
    expect(options?.jobId).toBeDefined();
    expect(options?.jobId).not.toContain(':');
  });

  it('jobId com forceUnique também não contém ":"', async () => {
    const { enqueue } = await import('@/lib/queue/queues');
    const { enqueueSendWhatsApp } = await import('@/lib/queue/enqueue-send-whatsapp');

    vi.mocked(enqueue).mockClear();

    await enqueueSendWhatsApp(
      { pacote_id: 'test-uuid-456', condominio_id: 'condo-1' },
      { forceUnique: true },
    );

    const call = vi.mocked(enqueue).mock.calls[0];
    const options = call?.[2] as { jobId?: string } | undefined;
    expect(options?.jobId).toBeDefined();
    expect(options?.jobId).not.toContain(':');
  });
});
