'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DespesaForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      servico: data.get('servico'),
      descricao: data.get('descricao'),
      id_pagamento: data.get('id_pagamento'),
      id_assinatura: data.get('id_assinatura'),
      valor_brl: data.get('valor_brl'),
      pago_em: data.get('pago_em'),
    };
    setSubmitting(true);
    try {
      const res = await fetch('/api/super-admin/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="servico">Serviço *</Label>
        <Input
          id="servico"
          name="servico"
          required
          maxLength={200}
          placeholder="Ex: KVM 2 — srv1650118.hstgr.cloud"
          disabled={submitting}
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          maxLength={2000}
          placeholder="Detalhes (opcional)"
          disabled={submitting}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="id_pagamento">ID de pagamento</Label>
        <Input
          id="id_pagamento"
          name="id_pagamento"
          maxLength={100}
          placeholder="Ex: H_42769663"
          disabled={submitting}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="id_assinatura">ID da assinatura</Label>
        <Input
          id="id_assinatura"
          name="id_assinatura"
          maxLength={100}
          placeholder="Ex: AzZJwXVIsATtc3htC"
          disabled={submitting}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="valor_brl">Valor (R$)</Label>
        <Input
          id="valor_brl"
          name="valor_brl"
          type="text"
          inputMode="decimal"
          placeholder="70.99 (vazio se sem nota)"
          disabled={submitting}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pago_em">Pago em *</Label>
        <Input
          id="pago_em"
          name="pago_em"
          type="date"
          defaultValue={today}
          required
          disabled={submitting}
        />
      </div>

      {error && (
        <p className="md:col-span-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="md:col-span-2">
        <Button type="submit" disabled={submitting} className="w-full md:w-auto">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Adicionar despesa'
          )}
        </Button>
      </div>
    </form>
  );
}
