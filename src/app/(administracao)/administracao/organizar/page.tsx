import Link from 'next/link';
import { Package, Clock } from 'lucide-react';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { listPacotesAguardandoOrganizacao } from '@/lib/db/pacote-organizar';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatTs(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdministracaoOrganizarPage() {
  const ctx = await requireAdminAny();
  const pacotes = await listPacotesAguardandoOrganizacao(ctx);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
        <Package className="size-6 text-primary" aria-hidden />
        Pacotes aguardando organização
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Pacotes recebidos pela portaria que ainda precisam ter setor e posição definidos antes
        do morador ser notificado.
      </p>

      {pacotes.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-text-secondary">
            Nenhum pacote aguardando organização no momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pacotes.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {p.destinatario_nome ?? p.nome_destinatario_etiqueta ?? 'Sem destinatário'}
                  </span>
                  {p.unidade_label && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {p.unidade_label}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" aria-hidden /> {formatTs(p.recebido_em)}
                  </span>
                  {p.funcionario_recebedor_nome && (
                    <span>recebido por {p.funcionario_recebedor_nome}</span>
                  )}
                </div>
              </div>
              <Link href={`/administracao/organizar/${p.id}`}>
                <Button size="sm">Organizar</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
