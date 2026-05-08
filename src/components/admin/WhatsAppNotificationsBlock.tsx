'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { PacoteDetailWhatsAppMessage } from '@/lib/db/pacote-admin-detail';

interface Props {
  pacoteId: string;
  pacoteStatus: string;
  messages: PacoteDetailWhatsAppMessage[];
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Pendente', tone: 'bg-muted text-text-secondary' },
  sent: { label: 'Enviado', tone: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Entregue', tone: 'bg-emerald-100 text-emerald-700' },
  read: { label: 'Lido', tone: 'bg-emerald-200 text-emerald-800' },
  failed: { label: 'Falhou', tone: 'bg-red-100 text-red-700' },
};

const MATCHED_BY_LABELS: Record<string, string> = {
  nome_etiqueta: 'pelo nome da etiqueta',
  principal: 'condômino principal (fallback)',
  fallback_adicional: 'adicional (último fallback)',
};

function formatTs(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone || '—';
  const start = phone.slice(0, Math.min(5, phone.length - 4));
  const end = phone.slice(-4);
  return `${start}…${end}`;
}

export function WhatsAppNotificationsBlock({ pacoteId, pacoteStatus, messages }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const lastMessage = messages[0];
  const canResend =
    pacoteStatus === 'aguardando_retirada' &&
    (!lastMessage ||
      lastMessage.status === 'failed' ||
      (lastMessage.status === 'pending' &&
        Date.now() - new Date(lastMessage.created_at).getTime() > 5 * 60 * 1000));

  async function handleResend() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacotes/${pacoteId}/reenviar-whatsapp`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };

      if (res.status === 429) {
        toast.error(data.message ?? 'Limite de reenvios atingido');
        return;
      }
      if (!res.ok) {
        toast.error(data.message ?? `Falha ao reenviar (${res.status})`);
        return;
      }
      toast.success('Notificação reenfileirada — atualize em alguns segundos');
      router.refresh();
    } catch {
      toast.error('Falha de rede ao reenviar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Notificações WhatsApp
        </h2>
        {canResend && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleResend}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Reenviar
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nenhuma notificação enviada{' '}
          {pacoteStatus === 'aguardando_retirada'
            ? 'ainda — clique em "Reenviar" para disparar manualmente.'
            : '.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const status = STATUS_LABELS[m.status] ?? { label: m.status, tone: 'bg-muted' };
            return (
              <li
                key={m.id}
                className="rounded-md border border-border bg-muted/30 p-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}
                  >
                    {status.label}
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    {maskPhone(m.to_phone)}
                  </span>
                </div>
                <div className="space-y-0.5 text-xs text-text-secondary">
                  <div>
                    <span className="font-medium">Criada:</span> {formatTs(m.created_at)}
                  </div>
                  {m.sent_at && (
                    <div>
                      <span className="font-medium">Enviada:</span> {formatTs(m.sent_at)}
                    </div>
                  )}
                  {m.delivered_at && (
                    <div>
                      <span className="font-medium">Entregue:</span> {formatTs(m.delivered_at)}
                    </div>
                  )}
                  {m.read_at && (
                    <div>
                      <span className="font-medium">Lida:</span> {formatTs(m.read_at)}
                    </div>
                  )}
                  {m.failed_at && (
                    <div className="text-red-700">
                      <span className="font-medium">Falhou:</span> {formatTs(m.failed_at)}
                      {m.failure_reason && ` — ${m.failure_reason}`}
                    </div>
                  )}
                  {m.matched_by && m.matched_by !== 'nome_etiqueta' && (
                    <div className="italic">Destinatário escolhido {MATCHED_BY_LABELS[m.matched_by] ?? m.matched_by}</div>
                  )}
                  {m.retry_count > 0 && (
                    <div>
                      <span className="font-medium">Retries:</span> {m.retry_count}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
