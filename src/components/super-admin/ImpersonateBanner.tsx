import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getImpersonationInfo } from '@/server/middleware/tenant';
import { ImpersonateStopButton } from '@/components/super-admin/ImpersonateStopButton';

/**
 * Banner persistente de impersonate (story 8.2).
 * Renderizado no RootLayout — server component lê cookie via getImpersonationInfo.
 * Não renderiza nada se sem impersonate ativo.
 */
export async function ImpersonateBanner() {
  let info: Awaited<ReturnType<typeof getImpersonationInfo>>;
  try {
    info = await getImpersonationInfo();
  } catch {
    return null;
  }
  if (!info.active) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm">
      <AlertTriangle className="size-4 text-warning" aria-hidden />
      <span className="font-medium">
        Impersonando: <strong>{info.condominioNome}</strong>
      </span>
      <span className="text-text-secondary">— você está vendo o painel como admin do cond.</span>
      <span className="ml-auto flex items-center gap-2">
        <ImpersonateStopButton />
        <Link href="/super-admin/condominios" className="text-xs text-primary underline">
          Voltar pro super-admin
        </Link>
      </span>
    </div>
  );
}
