import { Wallet, Sparkles, Plus } from 'lucide-react';
import { listDespesas } from '@/lib/db/despesa';
import { getIaUsageSummary, USD_TO_BRL } from '@/lib/ia-cost';
import { DespesaForm } from './DespesaForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fmtBRL(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtUSD(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}

export default async function FinancasPage() {
  const [despesas, iaUsage] = await Promise.all([
    listDespesas(),
    getIaUsageSummary(),
  ]);

  const totalManual = despesas.reduce(
    (s, d) => s + (d.valor_brl ?? 0),
    0,
  );
  const totalComIa = totalManual + iaUsage.totalCostBrl;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden>
          <Wallet className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Finanças</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Controle de gastos com infra, IA, telecom e outros.
          </p>
        </div>
      </header>

      {/* Cards de resumo */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Despesas manuais
          </p>
          <p className="mt-1 text-2xl font-semibold">{fmtBRL(totalManual)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {despesas.length} {despesas.length === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Custo IA estimado
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {fmtBRL(iaUsage.totalCostBrl)}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {fmtUSD(iaUsage.totalCostUsd)} · {iaUsage.totalCalls} chamadas
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Total acumulado
          </p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {fmtBRL(totalComIa)}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Cotação USD: R$ {USD_TO_BRL.toFixed(2)}
          </p>
        </div>
      </section>

      {/* Form pra adicionar despesa */}
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4" aria-hidden /> Adicionar despesa
        </h2>
        <DespesaForm />
      </section>

      {/* Tabela de despesas */}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Custo IA detalhado */}
      <section className="rounded-lg border border-border bg-background">
        <h2 className="flex items-center gap-2 border-b border-border p-4 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Custo IA detalhado
        </h2>
        {iaUsage.rows.length === 0 ? (
          <p className="p-4 text-sm text-text-secondary">
            Nenhuma chamada IA registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Modelo</th>
                  <th className="p-3 text-right">Chamadas</th>
                  <th className="p-3 text-right">Tokens in</th>
                  <th className="p-3 text-right">Tokens out</th>
                  <th className="p-3 text-right">Cache R</th>
                  <th className="p-3 text-right">USD</th>
                  <th className="p-3 text-right">BRL</th>
                </tr>
              </thead>
              <tbody>
                {iaUsage.rows.map((r) => (
                  <tr
                    key={`${r.provider}:${r.model}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="p-3 font-medium">{r.provider}</td>
                    <td className="p-3 font-mono text-xs">{r.model}</td>
                    <td className="p-3 text-right">{r.calls.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right text-xs">
                      {r.inputTokens.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {r.outputTokens.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {r.cacheReadTokens.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-right font-mono">{fmtUSD(r.costUsd)}</td>
                    <td className="p-3 text-right font-mono">{fmtBRL(r.costBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {iaUsage.unpricedModels.length > 0 && (
          <p className="border-t border-border p-3 text-xs text-warning-foreground">
            ⚠️ Modelos sem pricing definido (custo subestimado):{' '}
            {iaUsage.unpricedModels.join(', ')}. Atualize{' '}
            <code>src/lib/ia-cost.ts</code>.
          </p>
        )}
        <p className="border-t border-border p-3 text-xs text-text-secondary">
          Cotação USD usada: R$ {USD_TO_BRL.toFixed(2)}. Pricing snapshot 2026-05-11 — atualizar em{' '}
          <code>src/lib/ia-cost.ts</code> quando provider mudar.
        </p>
      </section>
    </div>
  );
}
