'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  pacoteId: string;
}

/**
 * Story 10.6: botão pra mover pacote `aguardando_retirada` → `em_administracao`.
 * Aparece no detalhe do pacote (admin) quando status permite.
 */
export function EnviarParaAdministracaoButton({ pacoteId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        'Enviar este pacote pra administração? Ele sairá da fila de retirada normal e a admin entregará pessoalmente ao morador.',
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pacotes/${pacoteId}/enviar-administracao`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok) {
        toast.error(data.message ?? `Falha ao enviar (${res.status})`);
        return;
      }
      toast.success('Pacote enviado pra administração');
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
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Building2 className="size-4" aria-hidden />
      )}
      Enviar pra administração
    </Button>
  );
}
