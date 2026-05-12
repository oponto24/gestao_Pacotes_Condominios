'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DespesaItem {
  id: string;
  servico: string;
  descricao: string | null;
  id_pagamento: string | null;
  id_assinatura: string | null;
  valor_brl: number | null;
  pago_em: string; // ISO date (YYYY-MM-DD)
}

interface Props {
  despesas: DespesaItem[];
}

function fmtBRL(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function DespesasManager({ despesas }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<DespesaItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const isEditMode = editing !== null;

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
      const url = isEditMode
        ? `/api/super-admin/despesas/${editing.id}`
        : '/api/super-admin/despesas';
      const method = isEditMode ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
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
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: DespesaItem) {
    const ok = window.confirm(
      `Excluir despesa "${item.servico}"?\n\nEssa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/despesas/${item.id}`, {
        method: 'DELETE',
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir');
    }
  }

  return (
    <>
      {/* Form */}
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="size-4" aria-hidden /> Editar despesa
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden /> Adicionar despesa
              </>
            )}
          </span>
          {isEditMode && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
              Cancelar edição
            </button>
          )}
        </h2>

        {/* key força remount quando muda entre create/edit pra reset os
            defaultValues. Senão React reusa instâncias e mantém values antigos. */}
        <form
          key={editing?.id ?? 'new'}
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="servico">Serviço *</Label>
            <Input
              id="servico"
              name="servico"
              required
              maxLength={200}
              defaultValue={editing?.servico ?? ''}
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
              defaultValue={editing?.descricao ?? ''}
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
              defaultValue={editing?.id_pagamento ?? ''}
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
              defaultValue={editing?.id_assinatura ?? ''}
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
              defaultValue={
                editing?.valor_brl !== null && editing?.valor_brl !== undefined
                  ? String(editing.valor_brl)
                  : ''
              }
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
              defaultValue={editing?.pago_em ?? todayIso}
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
              ) : isEditMode ? (
                'Salvar alterações'
              ) : (
                'Adicionar despesa'
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* Tabela */}
      <section className="rounded-lg border border-border bg-background">
        <h2 className="border-b border-border p-4 text-sm font-semibold">
          Despesas registradas
        </h2>
        {despesas.length === 0 ? (
          <p className="p-4 text-sm text-text-secondary">Nenhuma despesa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">ID pagamento</th>
                  <th className="p-3">ID assinatura</th>
                  <th className="p-3">Pago em</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{d.servico}</div>
                      {d.descricao && (
                        <div className="mt-0.5 text-xs text-text-secondary">
                          {d.descricao}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {d.id_pagamento ?? '—'}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {d.id_assinatura ?? '—'}
                    </td>
                    <td className="p-3 text-xs">{fmtDate(d.pago_em)}</td>
                    <td className="p-3 text-right font-mono text-sm">
                      {fmtBRL(d.valor_brl)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(d)}
                          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Editar ${d.servico}`}
                          title="Editar"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
                          aria-label={`Excluir ${d.servico}`}
                          title="Excluir"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
