import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsAppNotificationsBlock } from '@/components/admin/WhatsAppNotificationsBlock';
import type { PacoteDetailWhatsAppMessage } from '@/lib/db/pacote-admin-detail';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseMessage = (overrides: Partial<PacoteDetailWhatsAppMessage> = {}): PacoteDetailWhatsAppMessage => ({
  id: 'wm-1',
  status: 'sent',
  to_phone: '5511999999999',
  template_name: 'pacote_chegou',
  failure_reason: null,
  retry_count: 0,
  matched_by: 'nome_etiqueta',
  created_at: new Date('2026-05-08T10:00:00Z'),
  sent_at: new Date('2026-05-08T10:00:01Z'),
  delivered_at: null,
  read_at: null,
  failed_at: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('WhatsAppNotificationsBlock', () => {
  it('renderiza estado vazio quando sem mensagens (aguardando_retirada)', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[]}
      />,
    );
    expect(screen.getByText(/Nenhuma notificação enviada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar/i })).toBeInTheDocument();
  });

  it('NÃO mostra botão Reenviar se pacote já retirado', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="retirado"
        messages={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: /Reenviar/i })).not.toBeInTheDocument();
  });

  it('mostra botão Reenviar quando última mensagem falhou', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[
          baseMessage({
            status: 'failed',
            failed_at: new Date('2026-05-08T11:00:00Z'),
            failure_reason: '131026: Morador sem WhatsApp',
          }),
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /Reenviar/i })).toBeInTheDocument();
    // "Falhou" aparece tanto no badge quanto no entry de timestamp — getAllByText cobre ambos
    expect(screen.getAllByText(/Falhou/i).length).toBeGreaterThanOrEqual(1);
    // failure_reason aparece concatenado ao timestamp; useamos getAllByText pra evitar multiplos matches em DOM ancestrais
    expect(
      screen.getAllByText((_, el) =>
        Boolean(el?.textContent?.includes('131026: Morador sem WhatsApp')),
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('OCULTA botão Reenviar quando última mensagem está delivered', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[
          baseMessage({
            status: 'delivered',
            delivered_at: new Date(),
          }),
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: /Reenviar/i })).not.toBeInTheDocument();
  });

  it('telefone aparece mascarado', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[baseMessage({ to_phone: '5511987654321' })]}
      />,
    );
    expect(screen.getByText(/55119…4321/)).toBeInTheDocument();
  });

  it('mostra matched_by quando não foi nome_etiqueta', () => {
    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[baseMessage({ matched_by: 'principal' })]}
      />,
    );
    expect(screen.getByText(/Destinatário escolhido condômino principal/i)).toBeInTheDocument();
  });

  it('click em Reenviar dispara POST e mostra toast sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, job_id: 'job-1' }), { status: 200 }),
    );
    global.fetch = fetchMock;

    const { toast } = await import('sonner');

    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Reenviar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/pacotes/p1/reenviar-whatsapp', { method: 'POST' });
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('429 mostra toast de rate limit', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, message: 'Limite de 3 reenvios/hora atingido' }),
        { status: 429 },
      ),
    );
    const { toast } = await import('sonner');

    render(
      <WhatsAppNotificationsBlock
        pacoteId="p1"
        pacoteStatus="aguardando_retirada"
        messages={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reenviar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Limite'));
    });
  });
});
