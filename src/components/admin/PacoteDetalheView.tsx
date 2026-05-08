import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, Package, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PacoteStatusBadge } from '@/components/admin/PacoteStatusBadge';
import { PacoteTimeline } from '@/components/admin/PacoteTimeline';
import type { PacoteDetail } from '@/lib/db/pacote-admin-detail';

interface Props {
  pacote: PacoteDetail;
}

function formatTs(d: Date | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

export function PacoteDetalheView({ pacote }: Props) {
  const isPendente = pacote.status === 'pendente_identificacao';
  const isAguardando = pacote.status === 'aguardando_retirada';
  const isRetirado = pacote.status === 'retirado';
  const unidadeLabel = pacote.unidade
    ? `${pacote.unidade.bloco ? `Bloco ${pacote.unidade.bloco} · ` : ''}${pacote.unidade.identificador}`
    : null;
  const retiradoPor = pacote.retirado_por_morador
    ? pacote.retirado_por_morador.nome
    : pacote.retirado_por_terceiro;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/pacotes">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Package className="size-6 text-primary" aria-hidden />
          Pacote
        </h1>
        <PacoteStatusBadge status={pacote.status} />
      </div>

      {isPendente && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3"
        >
          <AlertTriangle className="mt-0.5 size-5 text-warning" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium">Pendente de identificação</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              IA não casou automaticamente com unidade/morador. Resolva manualmente abaixo.
            </p>
          </div>
          <Link href={`/chegada/confirmar/${pacote.id}`}>
            <Button>Resolver pendência</Button>
          </Link>
        </div>
      )}

      {isAguardando && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-3"
        >
          <QrCode className="mt-0.5 size-5 text-info" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium">Pronto pra retirada</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Morador notificado. Quando chegar na portaria, escaneie o QR Code dele.
            </p>
          </div>
          <Link href="/retirada">
            <Button variant="secondary">Ir pra retirada</Button>
          </Link>
        </div>
      )}

      {isRetirado && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3"
        >
          <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium">Pacote entregue</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Retirado em {formatTs(pacote.retirado_em)}
              {retiradoPor ? ` por ${retiradoPor}` : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Coluna esquerda: dados */}
        <section className="space-y-4 rounded-lg border border-border bg-background p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Dados do pacote
          </h2>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Destinatário" value={pacote.nome_destinatario_etiqueta} />
            <Field label="Unidade" value={unidadeLabel} />
            <Field label="Setor" value={pacote.setor?.nome} />
            <Field label="Posição" value={pacote.posicao} />
            <Field
              label="Tamanho"
              value={pacote.tamanho ? pacote.tamanho.replace('_', ' ') : null}
            />
            <Field label="Código" value={pacote.codigo_rastreio} />
            <Field label="Transportadora" value={pacote.transportadora} />
            <Field label="CEP" value={pacote.cep_etiqueta} />
            <Field label="Endereço" value={pacote.endereco_etiqueta} />
            <Field label="Complemento" value={pacote.complemento_etiqueta} />
            <Field label="Remetente" value={pacote.remetente} />
            <Field
              label="IA confiança"
              value={
                pacote.ia_confianca !== null
                  ? `${Math.round(pacote.ia_confianca * 100)}%`
                  : null
              }
            />
          </dl>

          <div className="border-t border-border pt-3">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Auditoria
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Recebido em" value={formatTs(pacote.recebido_em)} />
              <Field label="Recebedor" value={pacote.funcionario_recebedor?.nome} />
              <Field label="Retirado em" value={formatTs(pacote.retirado_em)} />
              <Field label="Entregador" value={pacote.funcionario_entregador?.nome} />
              <Field
                label="Retirado por"
                value={
                  retiradoPor
                    ? `${retiradoPor}${pacote.retirado_por_terceiro ? ' (terceiro)' : ''}`
                    : null
                }
              />
            </dl>
          </div>
        </section>

        {/* Coluna direita: foto + timeline */}
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Foto da etiqueta
            </h2>
            {pacote.foto_storage_path ? (
              <div className="rounded-md bg-muted p-3 text-xs text-text-secondary">
                {pacote.foto_storage_path}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Sem foto.</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Histórico
            </h2>
            <PacoteTimeline eventos={pacote.eventos} />
          </div>
        </section>
      </div>
    </div>
  );
}
