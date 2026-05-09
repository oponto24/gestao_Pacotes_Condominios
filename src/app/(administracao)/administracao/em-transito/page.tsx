import { Building2, Clock } from 'lucide-react';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { listPacotesEmAdministracao } from '@/lib/db/pacote-administracao';

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

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 8) return phone || '—';
  return `${phone.slice(0, 5)}…${phone.slice(-4)}`;
}

/**
 * Story 10.6: lista pacotes em `em_administracao`. Admin entrega ao morador
 * pessoalmente. Bipe entrega final acontece no fluxo /retirada padrão (qualquer
 * role operacional pode bipar — FR-083).
 */
export default async function AdministracaoEmTransitoPage() {
  const ctx = await requireAdminAny();
  const pacotes = await listPacotesEmAdministracao(ctx);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
        <Building2 className="size-6 text-primary" aria-hidden />
        Pacotes em trânsito pela administração
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Pacotes que saíram da portaria pra entrega via administração. A entrega final é feita
        com o QR do morador na tela <code className="rounded bg-muted px-1">/retirada</code>.
      </p>

      {pacotes.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-text-secondary">
            Nenhum pacote em trânsito no momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pacotes.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
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
                  <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-text-secondary md:grid-cols-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      Recebido: {formatTs(p.recebido_em)}
                    </span>
                    <span>📞 {maskPhone(p.destinatario_telefone)}</span>
                    {p.setor_nome && (
                      <span>
                        Estava em: {p.setor_nome}
                        {p.posicao ? ` (${p.posicao})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
