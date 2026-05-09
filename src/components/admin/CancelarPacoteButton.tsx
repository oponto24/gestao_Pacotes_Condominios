'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  pacoteId: string;
}

/**
 * Botão "Cancelar pacote" — apenas admin_master tem acesso (guard backend).
 * UI exibe botão pra todos no detalhe; backend rejeita se não for admin_master.
 */
export function CancelarPacoteButton({ pacoteId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const motivo = window.prompt(
      'Cancelar este pacote? Apenas admins master têm autorização.\n\nDigite o motivo do cancelamento (será registrado no audit):',
    );
    if (!motivo || !motivo.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/pacotes/${pacoteId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };

      if (res.status === 403) {
        toast.error('Apenas admin master pode cancelar pacotes');
        return;
      }
      if (!res.ok) {
        toast.error(data.message ?? `Falha ao cancelar (${res.status})`);
        return;
      }
      toast.success('Pacote cancelado');
      router.refresh();
    } catch {
      toast.error('Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <XCircle className="size-4" aria-hidden />
      )}
      Cancelar pacote
    </Button>
  );
}
